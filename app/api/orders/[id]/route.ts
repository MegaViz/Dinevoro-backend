import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Table from "@/models/Table";
import { serializeOrder } from "@/lib/serialize-resources";
import { notify } from "@/lib/notify";
import { creditCustomerForOrder, reverseCustomerForRefund } from "@/lib/customer-stats";
import { roundMoney } from "@/lib/billing";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const order = await Order.findOne({ _id: id, restaurant: auth.restaurantId });

  if (!order) {
    return withCors(request, jsonResponse({ error: "Order not found" }, 404));
  }

  return withCors(request, jsonResponse({ order: serializeOrder(order) }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = orderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const data = parsed.data;
    if (!data.status && !data.kitchenStatus && !data.mode && data.amount === undefined) {
      return withCors(request, jsonResponse({ error: "Nothing to update" }, 400));
    }

    await connectToDatabase();
    const existing = await Order.findOne({ _id: id, restaurant: auth.restaurantId });
    if (!existing) {
      return withCors(request, jsonResponse({ error: "Order not found" }, 404));
    }

    const update: Record<string, unknown> = {};
    if (data.kitchenStatus) update.kitchenStatus = data.kitchenStatus;
    if (data.mode) update.mode = data.mode;

    const isPayment = data.amount !== undefined || data.status === "Paid";
    const isRefund = data.status === "Refunded";
    let becamePaid = false;
    let paymentAmount = 0;

    if (isPayment && isRefund) {
      return withCors(request, jsonResponse({ error: "A payment and a refund cannot be recorded together" }, 400));
    }

    if (isPayment) {
      if (existing.status === "Refunded") {
        return withCors(request, jsonResponse({ error: `Bill #${existing.billNo} was refunded and cannot be collected` }, 400));
      }
      if (existing.status === "Paid") {
        return withCors(request, jsonResponse({ error: `Bill #${existing.billNo} is already paid` }, 400));
      }
      // Validate against what is actually still owed, never against the bill total.
      const alreadyPaid = existing.amountPaid ?? 0;
      const outstanding = roundMoney(existing.total - alreadyPaid);
      paymentAmount = data.amount ?? outstanding;
      if (paymentAmount > outstanding + 0.001) {
        return withCors(
          request,
          jsonResponse(
            { error: `Amount ₹${paymentAmount.toFixed(2)} is more than the ₹${outstanding.toFixed(2)} due on bill #${existing.billNo}` },
            400,
          ),
        );
      }
      const newPaid = roundMoney(alreadyPaid + paymentAmount);
      becamePaid = newPaid >= roundMoney(existing.total) - 0.001;
      update.amountPaid = becamePaid ? existing.total : newPaid;
      update.status = becamePaid ? "Paid" : "Pending";
      update.$push = { payments: { amount: paymentAmount, mode: data.mode ?? existing.mode, paidAt: new Date() } };
    } else if (isRefund) {
      if (existing.status !== "Paid") {
        return withCors(request, jsonResponse({ error: "Only fully paid bills can be refunded" }, 400));
      }
      update.status = "Refunded";
      update.refundedAt = new Date();
    } else if (data.status === "Pending" && existing.status !== "Pending") {
      return withCors(request, jsonResponse({ error: `Bill #${existing.billNo} is already ${existing.status.toLowerCase()}` }, 400));
    }

    // Conditional on the status we validated against, so two quick clicks cannot apply twice.
    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        restaurant: auth.restaurantId,
        status: existing.status,
        // Older bills have no amountPaid stored; null also matches a missing field.
        amountPaid: existing.amountPaid ? existing.amountPaid : { $in: [0, null] },
      },
      update,
      { new: true },
    );
    if (!order) {
      return withCors(request, jsonResponse({ error: "This bill was just updated. Refresh and try again." }, 409));
    }

    if (order.table) {
      if (data.kitchenStatus === "Served" || isRefund) {
        await Table.findByIdAndUpdate(order.table, {
          status: "Available",
          customerName: "",
          reservedAt: "",
          occupiedAt: null,
          currentOrder: null,
        });
      } else if (becamePaid) {
        await Table.findByIdAndUpdate(order.table, { status: "Billing" });
      }
    }

    if (isRefund) {
      await reverseCustomerForRefund(order);
      await notify({
        restaurantId: auth.restaurantId,
        title: `Refund Processed: #${order.billNo}`,
        message: `Refund of ₹${order.total.toFixed(2)} for bill #${order.billNo} has been recorded.`,
        category: "Payments",
        severity: "info",
      });
    }

    if (becamePaid) {
      await creditCustomerForOrder(order);
    } else if (isPayment) {
      await notify({
        restaurantId: auth.restaurantId,
        title: `Part Payment: #${order.billNo}`,
        message: `₹${paymentAmount.toFixed(2)} received for bill #${order.billNo}. ₹${roundMoney(order.total - order.amountPaid).toFixed(2)} is still due.`,
        category: "Payments",
        severity: "warning",
      });
    }

    const fresh = await Order.findById(order._id);
    return withCors(request, jsonResponse({ order: serializeOrder(fresh ?? order) }));
  } catch (err) {
    console.error("Update order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

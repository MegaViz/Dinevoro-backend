import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import { serializeOrder } from "@/lib/serialize-resources";
import { notify } from "@/lib/notify";
import { creditCustomerForOrder, reverseCustomerForRefund } from "@/lib/customer-stats";
import { amountReceived, roundMoney } from "@/lib/billing";
import { applyRecipeStock } from "@/lib/stock";
import { reconcileTables } from "@/lib/table-status";

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

const KITCHEN_FLOW = ["New", "Preparing", "Ready", "Served"] as const;

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

    const conflict = (error: string) => withCors(request, jsonResponse({ error }, 409));
    const closed = existing.status === "Refunded" || existing.status === "Void";

    const update: Record<string, unknown> = {};
    if (data.kitchenStatus && data.kitchenStatus !== existing.kitchenStatus) {
      // Kitchen tickets only move forward: New → Preparing → Ready → Served.
      if (closed) {
        return conflict(`Bill #${existing.billNo} is ${existing.status.toLowerCase()}; its kitchen ticket cannot change`);
      }
      const from = KITCHEN_FLOW.indexOf(existing.kitchenStatus as (typeof KITCHEN_FLOW)[number]);
      const to = KITCHEN_FLOW.indexOf(data.kitchenStatus);
      if (to < from) {
        return conflict(`Order #${existing.billNo} is already ${existing.kitchenStatus}; it cannot go back to ${data.kitchenStatus}`);
      }
      update.kitchenStatus = data.kitchenStatus;
    }
    if (data.mode) update.mode = data.mode;

    const isPayment = data.amount !== undefined || data.status === "Paid";
    const isRefund = data.status === "Refunded";
    const isVoid = data.status === "Void";
    let becamePaid = false;
    let paymentAmount = 0;
    let refundAmount = 0;
    let fullRefund = false;

    if ([isPayment, isRefund, isVoid].filter(Boolean).length > 1) {
      return withCors(request, jsonResponse({ error: "Record one payment, refund or void at a time" }, 400));
    }

    if (isPayment) {
      if (closed) {
        return conflict(`Bill #${existing.billNo} was ${existing.status === "Void" ? "voided" : "refunded"} and cannot be collected`);
      }
      if (existing.status === "Paid") {
        return conflict(`Bill #${existing.billNo} is already paid`);
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
        return conflict(`Only paid bills can be refunded; bill #${existing.billNo} is ${existing.status.toLowerCase()}`);
      }
      if (!data.reason) {
        return withCors(request, jsonResponse({ error: "Enter a reason for the refund" }, 400));
      }
      const received = amountReceived(existing);
      refundAmount = data.refundAmount ?? received;
      if (refundAmount > received + 0.001) {
        return withCors(
          request,
          jsonResponse({ error: `Refund ₹${refundAmount.toFixed(2)} is more than the ₹${received.toFixed(2)} received on bill #${existing.billNo}` }, 400),
        );
      }
      fullRefund = refundAmount >= received - 0.001;
      update.refundAmount = roundMoney((existing.refundAmount ?? 0) + refundAmount);
      update.refundReason = data.reason;
      update.refundedAt = new Date();
      // A part refund keeps the bill Paid; the remainder stays as revenue.
      if (fullRefund) update.status = "Refunded";
    } else if (isVoid) {
      if (existing.status !== "Pending" || (existing.amountPaid ?? 0) > 0) {
        return conflict(
          existing.status === "Pending"
            ? `Bill #${existing.billNo} already has a payment; refund it instead of voiding`
            : `Only unpaid bills can be voided; bill #${existing.billNo} is ${existing.status.toLowerCase()}`,
        );
      }
      if (!data.reason) {
        return withCors(request, jsonResponse({ error: "Enter a reason for voiding the bill" }, 400));
      }
      update.status = "Void";
      update.voidReason = data.reason;
      update.voidedAt = new Date();
    } else if (data.status === "Pending" && existing.status !== "Pending") {
      return conflict(`Bill #${existing.billNo} is already ${existing.status.toLowerCase()}`);
    }

    if (Object.keys(update).length === 0) {
      return withCors(request, jsonResponse({ order: serializeOrder(existing) }));
    }

    // Conditional on the status we validated against, so two quick clicks cannot apply twice.
    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        restaurant: auth.restaurantId,
        status: existing.status,
        kitchenStatus: existing.kitchenStatus,
        // Older bills have no amountPaid stored; null also matches a missing field.
        amountPaid: existing.amountPaid ? existing.amountPaid : { $in: [0, null] },
      },
      update,
      { new: true },
    );
    if (!order) {
      return conflict("This bill was just updated. Refresh and try again.");
    }

    if (order.table || order.orderType === "Dine-in") {
      await reconcileTables(auth.restaurantId);
    }

    if (isVoid) {
      await applyRecipeStock(order, 1);
      await notify({
        restaurantId: auth.restaurantId,
        title: `Bill Voided: #${order.billNo}`,
        message: `Bill #${order.billNo} (₹${order.total.toFixed(2)}) was voided. Reason: ${data.reason}.`,
        category: "Payments",
        severity: "info",
      });
    }

    if (isRefund) {
      await reverseCustomerForRefund(order, refundAmount);
      await notify({
        restaurantId: auth.restaurantId,
        title: `Refund Processed: #${order.billNo}`,
        message: `${fullRefund ? "Full" : "Part"} refund of ₹${refundAmount.toFixed(2)} for bill #${order.billNo} via ${data.mode ?? order.mode}. Reason: ${data.reason}.`,
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

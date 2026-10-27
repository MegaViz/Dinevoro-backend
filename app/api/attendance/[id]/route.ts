import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { onlyProvided, staffUpdateSchema } from "@/lib/validation";
import Staff from "@/models/Staff";
import { syncAttendanceDay } from "@/lib/attendance";
import { localDateKey } from "@/lib/dates";
import { serializeStaff } from "@/lib/serialize-resources";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function isLate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour > 8 || (hour === 8 && minute > 15);
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = staffUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const staff = await Staff.findOne({ _id: id, restaurant: auth.restaurantId });
    if (!staff) {
      return withCors(request, jsonResponse({ error: "Staff not found" }, 404));
    }

    const update: Record<string, unknown> = {};
    const today = localDateKey(new Date());
    // Times from an earlier day do not block today's shift.
    const checkedInToday = Boolean(staff.checkIn) && (!staff.attendanceDate || staff.attendanceDate === today);
    const checkedOutToday = checkedInToday && Boolean(staff.checkOut);

    if (parsed.data.action === "check-in") {
      if (checkedOutToday) {
        return withCors(request, jsonResponse({ error: `${staff.name} already checked out today at ${staff.checkOut}` }, 409));
      }
      if (checkedInToday) {
        return withCors(request, jsonResponse({ error: `${staff.name} is already checked in since ${staff.checkIn}` }, 409));
      }
      const now = new Date();
      update.checkIn = formatTime(now);
      update.checkOut = "";
      update.attendanceDate = today;
      update.status = isLate(now) ? "Late" : "Present";
    } else if (parsed.data.action === "check-out") {
      if (!checkedInToday) {
        return withCors(request, jsonResponse({ error: `${staff.name} has not checked in today` }, 409));
      }
      if (checkedOutToday) {
        return withCors(request, jsonResponse({ error: `${staff.name} already checked out at ${staff.checkOut}` }, 409));
      }
      update.checkOut = formatTime(new Date());
    } else if (parsed.data.status) {
      update.status = parsed.data.status;
      if (parsed.data.status === "Absent" || parsed.data.status === "Not Checked In") {
        update.checkIn = "";
        update.checkOut = "";
      }
    }

    Object.assign(update, onlyProvided({ name: parsed.data.name, role: parsed.data.role, phone: parsed.data.phone, shift: parsed.data.shift }, body));
    if (Object.keys(update).length === 0) {
      return withCors(request, jsonResponse({ error: "Nothing to update" }, 400));
    }

    const updated = await Staff.findByIdAndUpdate(id, update, { new: true });
    await syncAttendanceDay(auth.restaurantId);
    return withCors(request, jsonResponse({ staff: serializeStaff(updated!) }));
  } catch (err) {
    console.error("Update staff error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

/** Removes a staff member from the roster. The record is kept (inactive) so past attendance stays intact. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const staff = await Staff.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId, active: true }, { active: false }, { new: true });
  if (!staff) {
    return withCors(request, jsonResponse({ error: "Staff not found" }, 404));
  }
  await syncAttendanceDay(auth.restaurantId);
  return withCors(request, jsonResponse({ ok: true }));
}

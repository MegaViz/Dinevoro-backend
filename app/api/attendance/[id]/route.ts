import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { staffUpdateSchema } from "@/lib/validation";
import Staff from "@/models/Staff";
import AttendanceDay from "@/models/AttendanceDay";
import { serializeStaff } from "@/lib/serialize-resources";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function syncAttendanceDay(restaurantId: string) {
  const staff = await Staff.find({ restaurant: restaurantId, active: true });
  const present = staff.filter((s) => s.status === "Present").length;
  const late = staff.filter((s) => s.status === "Late").length;
  const absent = staff.filter((s) => s.status === "Absent" || s.status === "Off Duty").length;
  const total = staff.length;
  const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  await AttendanceDay.findOneAndUpdate(
    { restaurant: restaurantId, date: startOfDay() },
    { present, late, absent, attendancePct },
    { upsert: true, new: true },
  );
}

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

    if (parsed.data.action === "check-in") {
      const now = new Date();
      update.checkIn = formatTime(now);
      update.checkOut = "";
      update.status = isLate(now) ? "Late" : "Present";
    } else if (parsed.data.action === "check-out") {
      update.checkOut = formatTime(new Date());
    } else if (parsed.data.status) {
      update.status = parsed.data.status;
      if (parsed.data.status === "Absent") {
        update.checkIn = "";
        update.checkOut = "";
      }
    }

    const updated = await Staff.findByIdAndUpdate(id, update, { new: true });
    await syncAttendanceDay(auth.restaurantId);
    return withCors(request, jsonResponse({ staff: serializeStaff(updated!) }));
  } catch (err) {
    console.error("Update staff error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

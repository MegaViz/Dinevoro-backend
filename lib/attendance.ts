import Staff from "@/models/Staff";
import AttendanceDay from "@/models/AttendanceDay";
import { startOfDay, endOfDay, localDateKey } from "@/lib/dates";

type StaffList = Awaited<ReturnType<typeof Staff.find>>;

/** One set of counting rules for Today, History and Reports. */
export function countAttendance(staff: StaffList) {
  const present = staff.filter((s) => s.status === "Present").length;
  const late = staff.filter((s) => s.status === "Late").length;
  const absent = staff.filter((s) => s.status === "Absent").length;
  const offDuty = staff.filter((s) => s.status === "Off Duty").length;
  const scheduled = staff.length - offDuty;
  const attendancePct = scheduled > 0 ? Math.round(((present + late) / scheduled) * 100) : 0;
  return { total: staff.length, present, late, absent, offDuty, attendancePct };
}

/**
 * Writes today's summary from the live staff records. There is exactly one row per restaurant
 * and local date: the row is updated in place and any other row for the same date (for example
 * a seeded demo row stored at noon) is removed.
 */
export async function syncAttendanceDay(restaurantId: string, now = new Date()) {
  const staff = await Staff.find({ restaurant: restaurantId, active: true });
  const { present, late, absent, offDuty, attendancePct } = countAttendance(staff);
  const dayStart = startOfDay(now);

  await AttendanceDay.findOneAndUpdate(
    { restaurant: restaurantId, date: dayStart },
    { present, late, absent, offDuty, attendancePct, demo: false },
    { upsert: true, new: true },
  );
  await AttendanceDay.deleteMany({
    restaurant: restaurantId,
    date: { $gte: dayStart, $lte: endOfDay(now), $ne: dayStart },
  });
}

/** History rows, at most one per local date (live rows win over demo rows, then the newest). */
export async function attendanceHistory(restaurantId: string, limit = 10) {
  const rows = await AttendanceDay.find({ restaurant: restaurantId }).sort({ date: -1 }).limit(limit * 3);
  const byDate = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = localDateKey(new Date(row.date));
    const current = byDate.get(key);
    if (
      !current ||
      (current.demo && !row.demo) ||
      (current.demo === row.demo && new Date(row.updatedAt).getTime() > new Date(current.updatedAt).getTime())
    ) {
      byDate.set(key, row);
    }
  }
  return [...byDate.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
}

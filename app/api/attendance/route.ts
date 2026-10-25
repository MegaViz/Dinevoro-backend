import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { staffSchema } from "@/lib/validation";
import Staff from "@/models/Staff";
import { countAttendance, syncAttendanceDay, attendanceHistory } from "@/lib/attendance";
import { serializeStaff, serializeAttendanceDay } from "@/lib/serialize-resources";
import { seedDefaultStaff } from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultStaff(auth.restaurantId);

  const staff = await Staff.find({ restaurant: auth.restaurantId, active: true }).sort({ name: 1 });
  // Today's history row is always rebuilt from the live staff records, so History matches Today.
  await syncAttendanceDay(auth.restaurantId);
  const history = await attendanceHistory(auth.restaurantId, 10);

  const weeklyTrend = history.slice(0, 5).reverse().map((d) => ({
    label: new Date(d.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
    absent: d.absent,
    attendancePct: d.attendancePct,
  }));

  const avgAttendance =
    history.length > 0 ? Math.round(history.reduce((s, d) => s + d.attendancePct, 0) / history.length) : 87;
  const lateThisWeek = history.reduce((s, d) => s + d.late, 0);

  return withCors(
    request,
    jsonResponse({
      staff: staff.map(serializeStaff),
      summary: countAttendance(staff),
      history: history.map(serializeAttendanceDay),
      reportsSummary: {
        totalStaff: staff.length,
        presentToday: countAttendance(staff).present + countAttendance(staff).late,
        presentDetail: `${staff.filter((s) => s.status === "Present").length} present · ${staff.filter((s) => s.status === "Late").length} late · ${staff.filter((s) => s.status === "Absent").length} absent`,
        avgAttendance,
        lateThisWeek,
      },
      weeklyTrend,
    }),
  );
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const staff = await Staff.create({
      ...parsed.data,
      restaurant: auth.restaurantId,
      status: parsed.data.shift === "Evening" ? "Off Duty" : "Absent",
    });

    await syncAttendanceDay(auth.restaurantId);
    return withCors(request, jsonResponse({ staff: serializeStaff(staff) }, 201));
  } catch (err) {
    console.error("Create staff error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

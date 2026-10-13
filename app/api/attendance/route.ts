import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { staffSchema } from "@/lib/validation";
import Staff from "@/models/Staff";
import AttendanceDay from "@/models/AttendanceDay";
import { serializeStaff, serializeAttendanceDay } from "@/lib/serialize-resources";
import { seedDefaultStaff } from "@/lib/seed-demo-data";

function buildSummary(staff: Awaited<ReturnType<typeof Staff.find>>) {
  const morning = staff.filter((s) => s.shift === "Morning" || s.status !== "Off Duty");
  const present = staff.filter((s) => s.status === "Present").length;
  const late = staff.filter((s) => s.status === "Late").length;
  const absent = staff.filter((s) => s.status === "Absent").length;
  return { total: staff.length, present, late, absent, morningCount: morning.length };
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultStaff(auth.restaurantId);

  const staff = await Staff.find({ restaurant: auth.restaurantId, active: true }).sort({ name: 1 });
  const history = await AttendanceDay.find({ restaurant: auth.restaurantId }).sort({ date: -1 }).limit(10);

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
      summary: buildSummary(staff),
      history: history.map(serializeAttendanceDay),
      reportsSummary: {
        totalStaff: staff.length,
        presentToday: presentCount(staff),
        presentDetail: `${staff.filter((s) => s.status === "Present").length} present · ${staff.filter((s) => s.status === "Late").length} late · ${staff.filter((s) => s.status === "Absent").length} absent`,
        avgAttendance,
        lateThisWeek,
      },
      weeklyTrend,
    }),
  );
}

function presentCount(staff: Awaited<ReturnType<typeof Staff.find>>) {
  return staff.filter((s) => s.status === "Present" || s.status === "Late").length;
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

    return withCors(request, jsonResponse({ staff: serializeStaff(staff) }, 201));
  } catch (err) {
    console.error("Create staff error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

// GET /api/admin/stats
// Returns aggregate usage stats: total users, jobs, success/fail rates, jobs per day.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Total jobs breakdown
  const { data: jobCounts } = await service
    .from("jobs")
    .select("status");

  const total = jobCounts?.length ?? 0;
  const completed = jobCounts?.filter((j) => j.status === "completed").length ?? 0;
  const failed = jobCounts?.filter((j) => j.status === "failed").length ?? 0;
  const processing = jobCounts?.filter((j) => ["queued", "processing"].includes(j.status)).length ?? 0;

  // Jobs in last 7 days grouped by date
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentJobs } = await service
    .from("jobs")
    .select("created_at, status")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Group by date
  const byDay: Record<string, { total: number; completed: number; failed: number }> = {};
  for (const job of recentJobs ?? []) {
    const day = job.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, completed: 0, failed: 0 };
    byDay[day].total++;
    if (job.status === "completed") byDay[day].completed++;
    if (job.status === "failed") byDay[day].failed++;
  }

  // Total templates
  const { count: templateCount } = await service
    .from("templates")
    .select("*", { count: "exact", head: true });

  // Total files / storage estimate
  const { count: fileCount } = await service
    .from("files")
    .select("*", { count: "exact", head: true });

  // Total users via auth admin
  const { data: usersData } = await service.auth.admin.listUsers({ perPage: 1000 });
  const userCount = usersData?.users?.length ?? 0;

  // Active users (submitted at least one job in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: activeUserJobs } = await service
    .from("jobs")
    .select("user_id")
    .gte("created_at", thirtyDaysAgo.toISOString());
  const activeUsers = new Set(activeUserJobs?.map((j) => j.user_id) ?? []).size;

  return NextResponse.json({
    users: { total: userCount, active30d: activeUsers },
    jobs: {
      total,
      completed,
      failed,
      processing,
      successRate: total > 0 ? Math.round((completed / total) * 100) : null,
      errorRate: total > 0 ? Math.round((failed / total) * 100) : null,
    },
    templates: { total: templateCount ?? 0 },
    files: { total: fileCount ?? 0 },
    jobsByDay: byDay,
    generatedAt: new Date().toISOString(),
  });
}

// GET /api/admin/users
// Returns all registered users with job counts.

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

  // List all auth users
  const { data: authData, error: authError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  // Job counts per user
  const { data: jobRows } = await service.from("jobs").select("user_id, status");
  const jobsByUser: Record<string, { total: number; completed: number; failed: number }> = {};
  for (const job of jobRows ?? []) {
    if (!jobsByUser[job.user_id]) jobsByUser[job.user_id] = { total: 0, completed: 0, failed: 0 };
    jobsByUser[job.user_id].total++;
    if (job.status === "completed") jobsByUser[job.user_id].completed++;
    if (job.status === "failed") jobsByUser[job.user_id].failed++;
  }

  const users = (authData.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    confirmed: !!u.email_confirmed_at,
    banned: u.banned ?? false,
    jobs: jobsByUser[u.id] ?? { total: 0, completed: 0, failed: 0 },
  }));

  return NextResponse.json({ users });
}

// GET /api/admin/health
// Returns health status for DB, storage, and latest Vercel deployment.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";

async function checkDb(service: ReturnType<typeof createServiceClient>) {
  const start = Date.now();
  try {
    const { error } = await service.from("jobs").select("id").limit(1);
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function checkStorage(service: ReturnType<typeof createServiceClient>) {
  const start = Date.now();
  try {
    const { error } = await service.storage.getBucket("uploads");
    return { ok: !error, latencyMs: Date.now() - start, error: error?.message };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}

async function getVercelDeployment() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID ?? "prj_hbfrpJh5h5LKrp0lOJtpjYyZiOrG";
  if (!token) return { available: false, reason: "VERCEL_TOKEN not set" };

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 30 } }
    );
    if (!res.ok) return { available: false, reason: `Vercel API error: ${res.status}` };
    const { deployments } = await res.json();
    return { available: true, deployments: deployments ?? [] };
  } catch (e) {
    return { available: false, reason: String(e) };
  }
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const [db, storage, vercel] = await Promise.all([
    checkDb(service),
    checkStorage(service),
    getVercelDeployment(),
  ]);

  return NextResponse.json({ db, storage, vercel, checkedAt: new Date().toISOString() });
}

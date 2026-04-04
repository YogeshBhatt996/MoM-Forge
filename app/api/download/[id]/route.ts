// GET /api/download/:id  – generate a signed download URL for job output

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/supabase/storage";
import { isDemoMode } from "@/lib/demo-auth";
import { demoJobs, demoOutputs, getDemoUserFromToken } from "@/lib/demo-store";

const DEMO_COOKIE = "demo_session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    const token = _req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const job = demoJobs.get(id);
    if (!job || job.userId !== demoUser.id) return NextResponse.json({ error: "Output not found" }, { status: 404 });
    if (!demoOutputs.has(id)) return NextResponse.json({ error: "Output not found" }, { status: 404 });
    return NextResponse.json({
      signed_url: `/api/demo-download/${id}`,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      file_name: `minutes_${id}.xlsx`,
    });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Resolve job → output → file
  const { data: output } = await service
    .from("outputs")
    .select("*, file:files(*), job:jobs!inner(user_id)")
    .eq("job_id", id)
    .single();

  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });

  // Ownership guard (RLS covers DB, but double-check here)
  if ((output as { job: { user_id: string } }).job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = (output as { file: { storage_path: string; original_name: string } }).file;
  const { signedUrl, expiresAt } = await getSignedUrl(
    file.storage_path,
    "outputs",
    3600
  );

  return NextResponse.json({
    signed_url: signedUrl,
    expires_at: expiresAt,
    file_name: file.original_name,
  });
}

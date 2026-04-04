// POST /api/process/:id
// Triggers the full MoM processing pipeline for a job.
// In the MVP this runs synchronously in the route handler.
// Replace with a queue (Inngest, BullMQ, Trigger.dev) for production.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { processJob } from "@/lib/jobs/processor";
import { isDemoMode } from "@/lib/demo-auth";
import { demoJobs, getDemoUserFromToken } from "@/lib/demo-store";
import { processDemoJob } from "@/lib/demo-processor";

const DEMO_COOKIE = "demo_session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const job = demoJobs.get(id);
    if (!job || job.userId !== demoUser.id) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (["processing", "completed"].includes(job.status)) {
      return NextResponse.json({ error: `Job is already ${job.status}` }, { status: 409 });
    }
    try {
      await processDemoJob(id);
      return NextResponse.json({ job_id: id, status: "completed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      return NextResponse.json({ job_id: id, status: "failed", error: message }, { status: 500 });
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Verify ownership
  const { data: job } = await service
    .from("jobs")
    .select("id, status, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (["processing", "completed"].includes(job.status)) {
    return NextResponse.json(
      { error: `Job is already ${job.status}` },
      { status: 409 }
    );
  }

  // Mark queued immediately
  await service.from("jobs").update({ status: "queued" }).eq("id", id);
  await service.from("job_events").insert({
    job_id: id,
    status: "queued",
    message: "Job queued for processing",
  });

  // For MVP: run synchronously (swap for queue.push(jobId) in production)
  try {
    await processJob(id);
    return NextResponse.json({ job_id: id, status: "completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ job_id: id, status: "failed", error: message }, { status: 500 });
  }
}

// DELETE /api/admin/users/:id
// Deletes a user and all their associated data (jobs, files, templates, events).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-deletion
  if (user.id === targetUserId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const service = createServiceClient();

  // Delete in order to respect FK constraints:
  // job_events → jobs → files → templates → auth user
  await service.from("job_events").delete().eq("job_id",
    service.from("jobs").select("id").eq("user_id", targetUserId)
  );

  // Get job IDs to delete their events
  const { data: userJobs } = await service
    .from("jobs")
    .select("id")
    .eq("user_id", targetUserId);

  const jobIds = (userJobs ?? []).map((j) => j.id);
  if (jobIds.length > 0) {
    await service.from("job_events").delete().in("job_id", jobIds);
  }

  await service.from("jobs").delete().eq("user_id", targetUserId);
  await service.from("templates").delete().eq("user_id", targetUserId);
  await service.from("files").delete().eq("user_id", targetUserId);

  // Delete auth user (also removes their Supabase session)
  const { error: deleteError } = await service.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

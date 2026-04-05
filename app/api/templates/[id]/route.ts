// PATCH /api/templates/:id  – set as default
// DELETE /api/templates/:id – delete template

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const isDefault = body.is_default !== false;

  const service = createServiceClient();

  await service.from("templates").update({ is_default: false }).eq("user_id", user.id);

  if (isDefault) {
    const { error } = await service
      .from("templates")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Nullify template_id on any jobs that reference this template
  // so the FK constraint doesn't block deletion
  await service
    .from("jobs")
    .update({ template_id: null })
    .eq("template_id", id)
    .eq("user_id", user.id);

  const { error } = await service
    .from("templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

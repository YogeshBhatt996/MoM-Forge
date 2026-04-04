// GET  /api/templates        – list user's templates
// POST /api/templates        – upload a new template file directly

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { uploadFileToStorage } from "@/lib/supabase/storage";
import { ALLOWED_TEMPLATE_TYPES } from "@/lib/validation/upload-schema";
import { v4 as uuidv4 } from "uuid";

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "20971520", 10);

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("templates")
    .select("*, file:files(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || file?.name || "Unnamed Template";

  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });
  if (!ALLOWED_TEMPLATE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Template must be .xlsx, .docx, or .pdf" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  const service = createServiceClient();

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileId = uuidv4();
  const storagePath = `${user.id}/templates/${fileId}_${file.name}`;
  await uploadFileToStorage(fileBuffer, storagePath, file.type, "uploads");

  const { data: fileRecord, error: fErr } = await service
    .from("files")
    .insert({
      id: fileId,
      user_id: user.id,
      name: `${fileId}_${file.name}`,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      file_type: "template",
      storage_path: storagePath,
    })
    .select()
    .single();

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  const templateId = uuidv4();
  const { data: tmpl, error: tErr } = await service
    .from("templates")
    .insert({
      id: templateId,
      user_id: user.id,
      file_id: fileRecord.id,
      name: name.replace(/\.(xlsx|docx|pdf)$/i, ""),
    })
    .select("*, file:files(*)")
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  return NextResponse.json(tmpl, { status: 201 });
}

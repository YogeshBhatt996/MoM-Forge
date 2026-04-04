// POST /api/upload
// Accepts multipart form data with `transcript` and `template` files.
// Validates, uploads to Supabase Storage, creates file + template records.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadFileToStorage } from "@/lib/supabase/storage";
import {
  ALLOWED_TRANSCRIPT_TYPES,
  ALLOWED_TEMPLATE_TYPES,
} from "@/lib/validation/upload-schema";
import { isDemoMode } from "@/lib/demo-auth";
import { demoFiles, getDemoUserFromToken } from "@/lib/demo-store";
import { v4 as uuidv4 } from "uuid";

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "20971520", 10);
const DEMO_COOKIE = "demo_session";

export async function POST(req: NextRequest) {
  // Demo mode — bypass Supabase entirely
  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const formData = await req.formData();
      const transcriptFile = formData.get("transcript") as File | null;
      const templateFile = formData.get("template") as File | null;

      if (!transcriptFile) return NextResponse.json({ error: "Transcript file is required" }, { status: 400 });
      if (!templateFile) return NextResponse.json({ error: "Template file is required" }, { status: 400 });

      const transcriptId = uuidv4();
      const templateFileId = uuidv4();
      const templateId = uuidv4();

      demoFiles.set(transcriptId, {
        buffer: Buffer.from(await transcriptFile.arrayBuffer()),
        mimeType: transcriptFile.type,
        originalName: transcriptFile.name,
        sizeBytes: transcriptFile.size,
        fileType: "transcript",
      });
      demoFiles.set(templateFileId, {
        buffer: Buffer.from(await templateFile.arrayBuffer()),
        mimeType: templateFile.type,
        originalName: templateFile.name,
        sizeBytes: templateFile.size,
        fileType: "template",
      });

      return NextResponse.json({ transcript_file_id: transcriptId, template_file_id: templateFileId, template_id: templateId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const transcriptFile = formData.get("transcript") as File | null;
    const templateFile = formData.get("template") as File | null;
    const existingTemplateId = (formData.get("existing_template_id") as string) || null;
    const templateName =
      (formData.get("template_name") as string) || templateFile?.name || "Unnamed Template";
    const templateDescription = (formData.get("template_description") as string) || null;

    // ── Validate transcript ────────────────────────────────────────────────
    if (!transcriptFile) {
      return NextResponse.json({ error: "Transcript file is required" }, { status: 400 });
    }
    if (!ALLOWED_TRANSCRIPT_TYPES.includes(transcriptFile.type)) {
      return NextResponse.json(
        { error: "Transcript must be .txt, .pdf, or .docx" },
        { status: 400 }
      );
    }
    if (transcriptFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "Transcript file is too large" }, { status: 400 });
    }

    const service = createServiceClient();

    // ── Upload transcript ──────────────────────────────────────────────────
    const transcriptBuffer = Buffer.from(await transcriptFile.arrayBuffer());
    const transcriptId = uuidv4();
    const transcriptPath = `${user.id}/transcripts/${transcriptId}_${transcriptFile.name}`;
    await uploadFileToStorage(transcriptBuffer, transcriptPath, transcriptFile.type, "uploads");

    const { data: transcriptRecord, error: tErr } = await service
      .from("files")
      .insert({
        id: transcriptId,
        user_id: user.id,
        name: `${transcriptId}_${transcriptFile.name}`,
        original_name: transcriptFile.name,
        mime_type: transcriptFile.type,
        size_bytes: transcriptFile.size,
        file_type: "transcript",
        storage_path: transcriptPath,
      })
      .select()
      .single();

    if (tErr) throw new Error(`Failed to save transcript record: ${tErr.message}`);

    // ── Use existing template or upload new one ────────────────────────────
    let templateFileId: string;
    let templateId: string;

    if (existingTemplateId) {
      // Use an existing saved template
      const { data: existingTmpl, error: etErr } = await service
        .from("templates")
        .select("id, file_id")
        .eq("id", existingTemplateId)
        .eq("user_id", user.id)
        .single();
      if (etErr || !existingTmpl) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      templateFileId = existingTmpl.file_id;
      templateId = existingTmpl.id;
    } else {
      // Validate and upload new template file
      if (!templateFile) {
        return NextResponse.json({ error: "Template file is required" }, { status: 400 });
      }
      if (!ALLOWED_TEMPLATE_TYPES.includes(templateFile.type)) {
        return NextResponse.json(
          { error: "Template must be an .xlsx, .docx, or .pdf file" },
          { status: 400 }
        );
      }
      if (templateFile.size > MAX_SIZE) {
        return NextResponse.json({ error: "Template file is too large" }, { status: 400 });
      }

      const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
      templateFileId = uuidv4();
      const templatePath = `${user.id}/templates/${templateFileId}_${templateFile.name}`;
      await uploadFileToStorage(templateBuffer, templatePath, templateFile.type, "uploads");

      const { data: templateFileRecord, error: tmfErr } = await service
        .from("files")
        .insert({
          id: templateFileId,
          user_id: user.id,
          name: `${templateFileId}_${templateFile.name}`,
          original_name: templateFile.name,
          mime_type: templateFile.type,
          size_bytes: templateFile.size,
          file_type: "template",
          storage_path: templatePath,
        })
        .select()
        .single();

      if (tmfErr) throw new Error(`Failed to save template file record: ${tmfErr.message}`);
      templateFileId = templateFileRecord.id;

      templateId = uuidv4();
      const { error: tmErr } = await service.from("templates").insert({
        id: templateId,
        user_id: user.id,
        file_id: templateFileId,
        name: templateName,
        description: templateDescription,
      });
      if (tmErr) throw new Error(`Failed to save template record: ${tmErr.message}`);
    }

    return NextResponse.json({
      transcript_file_id: transcriptRecord.id,
      template_file_id: templateFileId,
      template_id: templateId,
    });
  } catch (err) {
    console.error("[/api/upload]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

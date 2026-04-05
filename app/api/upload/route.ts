// POST /api/upload
// Accepts multipart form data with `transcript` (required) and optional `template`.
// Template is never auto-saved to the Template Library — only explicitly saved
// templates (uploaded via the Templates page) appear there.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { uploadFileToStorage } from "@/lib/supabase/storage";
import { ALLOWED_TRANSCRIPT_TYPES, ALLOWED_TEMPLATE_TYPES } from "@/lib/validation/upload-schema";
import { isDemoMode } from "@/lib/demo-auth";
import { demoFiles, getDemoUserFromToken } from "@/lib/demo-store";
import { v4 as uuidv4 } from "uuid";

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "20971520", 10);
const DEMO_COOKIE = "demo_session";

export async function POST(req: NextRequest) {
  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const formData = await req.formData();
      const transcriptFile = formData.get("transcript") as File | null;
      const templateFile = formData.get("template") as File | null;

      if (!transcriptFile) return NextResponse.json({ error: "Transcript file is required" }, { status: 400 });

      const transcriptId = uuidv4();
      demoFiles.set(transcriptId, {
        buffer: Buffer.from(await transcriptFile.arrayBuffer()),
        mimeType: transcriptFile.type,
        originalName: transcriptFile.name,
        sizeBytes: transcriptFile.size,
        fileType: "transcript",
      });

      let templateFileId: string | null = null;
      if (templateFile) {
        templateFileId = uuidv4();
        demoFiles.set(templateFileId, {
          buffer: Buffer.from(await templateFile.arrayBuffer()),
          mimeType: templateFile.type,
          originalName: templateFile.name,
          sizeBytes: templateFile.size,
          fileType: "template",
        });
      }

      return NextResponse.json({
        transcript_file_id: transcriptId,
        template_file_id: templateFileId,
        template_id: null,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const transcriptFile = formData.get("transcript") as File | null;
    const templateFile = formData.get("template") as File | null;
    const existingTemplateId = (formData.get("existing_template_id") as string) || null;

    // ── Validate transcript ────────────────────────────────────────────────
    if (!transcriptFile) return NextResponse.json({ error: "Transcript file is required" }, { status: 400 });
    if (!ALLOWED_TRANSCRIPT_TYPES.includes(transcriptFile.type)) {
      return NextResponse.json({ error: "Transcript must be .txt, .pdf, or .docx" }, { status: 400 });
    }
    if (transcriptFile.size > MAX_SIZE) return NextResponse.json({ error: "Transcript file is too large" }, { status: 400 });

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

    // ── Handle template (optional) ─────────────────────────────────────────
    let templateFileId: string | null = null;
    let templateId: string | null = null;

    if (existingTemplateId) {
      // Use a saved template from the library
      const { data: existingTmpl } = await service
        .from("templates")
        .select("id, file_id")
        .eq("id", existingTemplateId)
        .eq("user_id", user.id)
        .single();
      if (!existingTmpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      templateFileId = existingTmpl.file_id;
      templateId = existingTmpl.id;

    } else if (templateFile) {
      // One-off template file — upload the file but do NOT save to Template Library
      if (!ALLOWED_TEMPLATE_TYPES.includes(templateFile.type)) {
        return NextResponse.json({ error: "Template must be .xlsx, .docx, or .pdf" }, { status: 400 });
      }
      if (templateFile.size > MAX_SIZE) return NextResponse.json({ error: "Template file is too large" }, { status: 400 });

      const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
      const tfId = uuidv4();
      const templatePath = `${user.id}/templates/${tfId}_${templateFile.name}`;
      await uploadFileToStorage(templateBuffer, templatePath, templateFile.type, "uploads");

      const { data: tfRecord, error: tmfErr } = await service
        .from("files")
        .insert({
          id: tfId,
          user_id: user.id,
          name: `${tfId}_${templateFile.name}`,
          original_name: templateFile.name,
          mime_type: templateFile.type,
          size_bytes: templateFile.size,
          file_type: "template",
          storage_path: templatePath,
        })
        .select()
        .single();

      if (tmfErr) throw new Error(`Failed to save template file record: ${tmfErr.message}`);
      templateFileId = tfRecord.id;
      // templateId stays null — not added to Template Library
    }
    // else: no template at all — both stay null, Word doc will be generated

    return NextResponse.json({
      transcript_file_id: transcriptRecord.id,
      template_file_id: templateFileId,
      template_id: templateId,
    });
  } catch (err) {
    console.error("[/api/upload]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}

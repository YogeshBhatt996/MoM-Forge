// ─────────────────────────────────────────────────────────────────────────────
// Job Processor
// Orchestrates the full MoM pipeline for a given job ID.
// Designed to be called from a Route Handler, a background worker, or a queue.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { downloadFromStorage, uploadFileToStorage } from "@/lib/supabase/storage";
import { extractTranscriptText } from "@/lib/transcript";
import { analyzeExcelTemplate, describeTemplateForPrompt } from "@/lib/template-analysis";
import { createAIProvider } from "@/lib/ai/factory";
import { generateExcelOutput } from "@/lib/excel/generator";
import type { DBJob, DBFile, DBTemplate, JobStatus, MoMData, TemplateStructure } from "@/types";
import { v4 as uuidv4 } from "uuid";

async function logEvent(
  jobId: string,
  status: JobStatus,
  message: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createServiceClient();
  await supabase.from("job_events").insert({
    job_id: jobId,
    status,
    message,
    metadata: metadata ?? null,
  });
}

async function setJobStatus(
  jobId: string,
  status: JobStatus,
  extra?: Partial<DBJob>
) {
  const supabase = createServiceClient();
  await supabase
    .from("jobs")
    .update({ status, ...extra })
    .eq("id", jobId);
}

export async function processJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  // ── 1. Load job ────────────────────────────────────────────────────────────
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) throw new Error(`Job ${jobId} not found`);

  await setJobStatus(jobId, "processing");
  await logEvent(jobId, "processing", "Pipeline started");

  try {
    // ── 2. Load transcript file ─────────────────────────────────────────────
    const { data: transcriptFile } = await supabase
      .from("files")
      .select("*")
      .eq("id", job.transcript_file_id)
      .single<DBFile>();

    if (!transcriptFile) throw new Error("Transcript file record not found");

    await logEvent(jobId, "processing", "Downloading transcript");
    const transcriptBuffer = await downloadFromStorage(
      transcriptFile.storage_path,
      "uploads"
    );

    // ── 3. Extract transcript text ──────────────────────────────────────────
    await logEvent(jobId, "processing", "Extracting transcript text");
    const transcriptText = await extractTranscriptText(
      transcriptBuffer,
      transcriptFile.mime_type
    );

    // ── 4. Load & analyse template ──────────────────────────────────────────
    let templateStructure: TemplateStructure | null = null;
    let templateDescription = "No template provided – use standard MoM layout.";

    if (job.template_file_id) {
      const { data: templateFile } = await supabase
        .from("files")
        .select("*")
        .eq("id", job.template_file_id)
        .single<DBFile>();

      if (templateFile) {
        await logEvent(jobId, "processing", "Analysing Excel template structure");
        const templateBuffer = await downloadFromStorage(
          templateFile.storage_path,
          "uploads"
        );
        templateStructure = await analyzeExcelTemplate(templateBuffer);
        templateDescription = describeTemplateForPrompt(templateStructure);

        // Persist structure to template record if template_id present
        if (job.template_id) {
          await supabase
            .from("templates")
            .update({ structure_json: templateStructure })
            .eq("id", job.template_id);
        }
      }
    }

    // ── 5. Load active prompt ───────────────────────────────────────────────
    const { data: promptRow } = await supabase
      .from("prompt_versions")
      .select("content")
      .eq("name", "mom_extraction")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const promptTemplate = promptRow?.content ?? DEFAULT_PROMPT_FALLBACK;

    // ── 6. AI extraction ────────────────────────────────────────────────────
    await logEvent(jobId, "processing", "Running AI extraction");
    const aiProvider = createAIProvider();
    const momData: MoMData = await aiProvider.extractMoM(
      transcriptText,
      templateDescription,
      promptTemplate
    );

    await setJobStatus(jobId, "processing", { ai_raw_json: momData });

    // ── 7. Map to template ──────────────────────────────────────────────────
    await logEvent(jobId, "processing", "Mapping MoM data to template structure");
    // For MVP, mapped_json is the same as ai_raw_json.
    // Replace this layer with a smarter mapping engine for arbitrary templates.
    const mappedJson = momData;
    await setJobStatus(jobId, "processing", { mapped_json: mappedJson as unknown as Record<string,unknown> });

    // ── 8. Generate Excel ───────────────────────────────────────────────────
    await logEvent(jobId, "processing", "Generating Excel output");
    const excelBuffer = await generateExcelOutput(momData, templateStructure);

    // ── 9. Upload output ────────────────────────────────────────────────────
    const outputFileName = `output_${jobId}.xlsx`;
    const outputPath = `${job.user_id}/${outputFileName}`;

    await uploadFileToStorage(
      excelBuffer,
      outputPath,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "outputs"
    );

    // Create file record
    const outputFileId = uuidv4();
    await supabase.from("files").insert({
      id: outputFileId,
      user_id: job.user_id,
      name: outputFileName,
      original_name: outputFileName,
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size_bytes: excelBuffer.byteLength,
      file_type: "output",
      storage_path: outputPath,
    });

    // Create output record
    await supabase.from("outputs").insert({
      job_id: jobId,
      file_id: outputFileId,
    });

    // ── 10. Mark complete ───────────────────────────────────────────────────
    await setJobStatus(jobId, "completed");
    await logEvent(jobId, "completed", "Pipeline completed successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setJobStatus(jobId, "failed", { error_message: message });
    await logEvent(jobId, "failed", `Pipeline failed: ${message}`);
    throw err;
  }
}

// Inline fallback prompt in case the DB record is missing
const DEFAULT_PROMPT_FALLBACK = `You are an expert business documentation assistant.
Extract structured meeting minutes from the transcript below.
Return ONLY valid JSON matching this schema:
{ meeting_title, meeting_date, meeting_time, location_or_platform, facilitator,
  attendees: [{name, role, organization}],
  agenda_items: [string],
  discussion_summary: [{topic, summary, decisions: [string]}],
  action_items: [{action, owner, due_date, status_remarks}],
  next_meeting: {date, time, agenda},
  additional_notes }

Use "Not specified in transcript" for any missing field.

Template sections:
{{TEMPLATE_SECTIONS}}

Transcript:
{{TRANSCRIPT}}`;

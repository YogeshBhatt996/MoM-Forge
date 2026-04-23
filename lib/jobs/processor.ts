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
import { generateWordOutput } from "@/lib/word/generator";
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

    // ── 8. Build output filename: MoM_<Title>_<Date>.<ext> ────────────────────
    const rawTitle =
      job.meeting_title_hint ||
      momData.meeting_title ||
      transcriptFile?.original_name?.replace(/\.(txt|pdf|docx)$/i, "").replace(/[_\-]+/g, " ").trim() ||
      "Meeting";

    const rawDate =
      job.meeting_date_hint ||
      momData.meeting_date ||
      new Date().toISOString().split("T")[0];

    const safeTitle = rawTitle
      .replace(/[^a-zA-Z0-9\s\-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 60);

    const safeDate = rawDate
      .replace(/[^0-9\-\/]/g, "")
      .replace(/\//g, "-")
      .substring(0, 10);

    // ── 9. Generate output (Word if no template, Excel if template provided) ──
    let outputBuffer: Buffer;
    let outputFileName: string;
    let outputMime: string;

    if (!job.template_file_id) {
      await logEvent(jobId, "processing", "Generating Word document output");
      outputBuffer = await generateWordOutput(momData);
      outputFileName = `MoM_${safeTitle}_${safeDate}.docx`;
      outputMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      await logEvent(jobId, "processing", "Generating Excel output");
      outputBuffer = await generateExcelOutput(momData, templateStructure);
      outputFileName = `MoM_${safeTitle}_${safeDate}.xlsx`;
      outputMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // ── 10. Upload output ───────────────────────────────────────────────────
    const outputPath = `${job.user_id}/${outputFileName}`;

    await uploadFileToStorage(
      outputBuffer,
      outputPath,
      outputMime,
      "outputs"
    );

    // Create file record
    const outputFileId = uuidv4();
    await supabase.from("files").insert({
      id: outputFileId,
      user_id: job.user_id,
      name: outputFileName,
      original_name: outputFileName,
      mime_type: outputMime,
      size_bytes: outputBuffer.byteLength,
      file_type: "output",
      storage_path: outputPath,
    });

    // Create output record
    await supabase.from("outputs").insert({
      job_id: jobId,
      file_id: outputFileId,
    });

    // ── 11. Mark complete ───────────────────────────────────────────────────
    await setJobStatus(jobId, "completed");
    await logEvent(jobId, "completed", "Pipeline completed successfully");

    // ── 12. Prune storage — keep only the 20 most recent output files ───────
    await pruneOldOutputs(job.user_id).catch((e) =>
      console.warn("[pruneOldOutputs] Non-fatal cleanup error:", e)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setJobStatus(jobId, "failed", { error_message: message });
    await logEvent(jobId, "failed", `Pipeline failed: ${message}`);
    throw err;
  }
}

// ─── Storage pruning ─────────────────────────────────────────────────────────
/**
 * Deletes output files from storage for jobs beyond the 20 most recent
 * completed jobs per user. DB records are preserved for audit history.
 */
async function pruneOldOutputs(userId: string, keepCount = 20): Promise<void> {
  const supabase = createServiceClient();
  const OUTPUTS_BUCKET = process.env.SUPABASE_BUCKET_OUTPUTS ?? "outputs";

  // All completed jobs for this user, newest first
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (!jobs || jobs.length <= keepCount) return;

  const oldJobIds = jobs.slice(keepCount).map((j) => j.id);

  // Find output file IDs for the old jobs
  const { data: outputs } = await supabase
    .from("outputs")
    .select("file_id")
    .in("job_id", oldJobIds);

  if (!outputs?.length) return;

  const fileIds = outputs.map((o) => o.file_id).filter(Boolean);

  // Get their storage paths
  const { data: files } = await supabase
    .from("files")
    .select("storage_path")
    .in("id", fileIds);

  const paths = (files ?? [])
    .map((f) => f.storage_path)
    .filter((p): p is string => !!p);

  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(OUTPUTS_BUCKET).remove(paths);
  if (error) {
    console.warn("[pruneOldOutputs] Storage remove error:", error.message);
  } else {
    console.log(`[pruneOldOutputs] Removed ${paths.length} old output file(s) from storage.`);
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

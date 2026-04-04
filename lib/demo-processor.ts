// Demo Mode pipeline — runs the full MoM extraction without Supabase.
// Uses demoFiles/demoJobs/demoOutputs instead of Supabase Storage + DB.

import { extractTranscriptText } from "@/lib/transcript";
import { analyzeExcelTemplate, describeTemplateForPrompt } from "@/lib/template-analysis";
import { createAIProvider } from "@/lib/ai/factory";
import { generateExcelOutput } from "@/lib/excel/generator";
import { demoFiles, demoJobs, demoEvents, demoOutputs } from "@/lib/demo-store";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_PROMPT = `You are an expert business documentation assistant.
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
Template sections: {{TEMPLATE_SECTIONS}}
Transcript: {{TRANSCRIPT}}`;

function addEvent(jobId: string, status: string, message: string) {
  const events = demoEvents.get(jobId) ?? [];
  events.push({ id: uuidv4(), jobId, status, message, createdAt: new Date().toISOString() });
  demoEvents.set(jobId, events);
}

export async function processDemoJob(jobId: string): Promise<void> {
  const job = demoJobs.get(jobId);
  if (!job) throw new Error(`Demo job ${jobId} not found`);

  job.status = "processing";
  addEvent(jobId, "processing", "Pipeline started");

  try {
    const transcriptFile = demoFiles.get(job.transcriptFileId);
    if (!transcriptFile) throw new Error("Transcript file not found in demo store");

    addEvent(jobId, "processing", "Extracting transcript text");
    const transcriptText = await extractTranscriptText(
      transcriptFile.buffer.buffer as ArrayBuffer,
      transcriptFile.mimeType
    );

    let templateDescription = "No template provided – use standard MoM layout.";
    let templateStructure = null;

    if (job.templateFileId) {
      const templateFile = demoFiles.get(job.templateFileId);
      if (templateFile) {
        addEvent(jobId, "processing", "Analysing Excel template structure");
        templateStructure = await analyzeExcelTemplate(
          templateFile.buffer.buffer as ArrayBuffer
        );
        templateDescription = describeTemplateForPrompt(templateStructure);
      }
    }

    addEvent(jobId, "processing", "Running AI extraction");
    const aiProvider = createAIProvider();
    const momData = await aiProvider.extractMoM(transcriptText, templateDescription, DEFAULT_PROMPT);

    job.aiRawJson = momData as unknown as Record<string, unknown>;

    addEvent(jobId, "processing", "Generating Excel output");
    const excelBuffer = await generateExcelOutput(momData, templateStructure);
    demoOutputs.set(jobId, excelBuffer);

    job.status = "completed";
    addEvent(jobId, "completed", "Pipeline completed successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.status = "failed";
    job.errorMessage = message;
    addEvent(jobId, "failed", `Pipeline failed: ${message}`);
    throw err;
  }
}

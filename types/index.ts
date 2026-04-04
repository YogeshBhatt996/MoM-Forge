// ─────────────────────────────────────────────────────────────────────────────
// MoM Forge – Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "requires_review";

export type FileType = "transcript" | "template" | "output";

// ─── Database row shapes (match Supabase schema) ──────────────────────────────

export interface DBUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface DBFile {
  id: string;
  user_id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  file_type: FileType;
  storage_path: string;
  created_at: string;
}

export interface DBTemplate {
  id: string;
  user_id: string;
  file_id: string;
  name: string;
  description: string | null;
  structure_json: TemplateStructure | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBJob {
  id: string;
  user_id: string;
  transcript_file_id: string;
  template_id: string | null;
  template_file_id: string | null;
  status: JobStatus;
  error_message: string | null;
  ai_raw_json: MoMData | null;
  mapped_json: Record<string, unknown> | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface DBJobEvent {
  id: string;
  job_id: string;
  status: JobStatus;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DBOutput {
  id: string;
  job_id: string;
  file_id: string;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface DBPromptVersion {
  id: string;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ─── Domain objects ───────────────────────────────────────────────────────────

export interface Attendee {
  name: string;
  role: string;
  organization: string;
}

export interface DiscussionPoint {
  topic: string;
  summary: string;
  decisions: string[];
}

export interface ActionItem {
  action: string;
  owner: string;
  due_date: string;
  status_remarks: string;
}

export interface NextMeeting {
  date: string;
  time: string;
  agenda: string;
}

/** Normalized meeting data extracted from transcript */
export interface MoMData {
  meeting_title: string;
  meeting_date: string;
  meeting_time: string;
  location_or_platform: string;
  facilitator: string;
  attendees: Attendee[];
  agenda_items: string[];
  discussion_summary: DiscussionPoint[];
  action_items: ActionItem[];
  next_meeting: NextMeeting;
  additional_notes: string;
}

// ─── Template Analysis ────────────────────────────────────────────────────────

export interface TemplateColumn {
  header: string;
  index: number;
  dataType: "text" | "date" | "number" | "unknown";
  sample_values: string[];
}

export interface TemplateSheet {
  name: string;
  index: number;
  columns: TemplateColumn[];
  row_count: number;
  purpose: string;  // inferred purpose, e.g. "action_items", "discussion", etc.
}

export interface TemplateStructure {
  sheets: TemplateSheet[];
  primary_sheet: string;
  detected_sections: string[];
  has_header_row: boolean;
}

// ─── API payload shapes ───────────────────────────────────────────────────────

export interface UploadResponse {
  transcript_file_id: string;
  template_file_id: string;
  template_id?: string;
}

export interface CreateJobResponse {
  job_id: string;
}

export interface JobDetailResponse extends DBJob {
  transcript_file: DBFile;
  template_file: DBFile | null;
  template: DBTemplate | null;
  events: DBJobEvent[];
  output: (DBOutput & { file: DBFile }) | null;
}

export interface ProcessResponse {
  job_id: string;
  status: JobStatus;
}

export interface DownloadResponse {
  signed_url: string;
  expires_at: string;
  file_name: string;
}

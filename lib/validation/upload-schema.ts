import { z } from "zod";

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "20971520", 10);

export const ALLOWED_TRANSCRIPT_TYPES = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export const ALLOWED_TEMPLATE_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export const uploadRequestSchema = z.object({
  transcript_mime: z.string().refine((m) => ALLOWED_TRANSCRIPT_TYPES.includes(m), {
    message: "Transcript must be .txt, .pdf, or .docx",
  }),
  transcript_size: z.number().max(MAX_SIZE, "Transcript exceeds maximum file size"),
  template_mime: z.string().refine((m) => ALLOWED_TEMPLATE_TYPES.includes(m), {
    message: "Template must be an .xlsx Excel file",
  }),
  template_size: z.number().max(MAX_SIZE, "Template exceeds maximum file size"),
  template_name: z.string().min(1).max(255).optional(),
  template_description: z.string().max(1000).optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

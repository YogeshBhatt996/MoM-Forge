// In-memory store for Demo Mode (no Supabase required).
// Lives for the lifetime of the dev server process.

export interface DemoFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  fileType: "transcript" | "template" | "output";
}

export interface DemoJob {
  id: string;
  userId: string;
  transcriptFileId: string;
  templateFileId: string | null;
  templateId: string | null;
  status: string;
  errorMessage: string | null;
  aiRawJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface DemoEvent {
  id: string;
  jobId: string;
  status: string;
  message: string;
  createdAt: string;
}

// Global singletons — persist across requests in the same Node process
export const demoFiles = new Map<string, DemoFile>();
export const demoJobs = new Map<string, DemoJob>();
export const demoEvents = new Map<string, DemoEvent[]>(); // jobId → events[]
export const demoOutputs = new Map<string, Buffer>();     // jobId → excel buffer

export function getDemoUserFromToken(token: string): { id: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const email = decoded.split(":")[0];
    if (!email) return null;
    return { id: `demo-${email}`, email };
  } catch {
    return null;
  }
}

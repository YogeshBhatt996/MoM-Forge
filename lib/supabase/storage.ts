import { createServiceClient } from "./server";

const UPLOADS_BUCKET = process.env.SUPABASE_BUCKET_UPLOADS ?? "uploads";
const OUTPUTS_BUCKET = process.env.SUPABASE_BUCKET_OUTPUTS ?? "outputs";

export async function uploadFileToStorage(
  buffer: Buffer,
  path: string,
  mimeType: string,
  bucket: "uploads" | "outputs" = "uploads"
): Promise<string> {
  const supabase = createServiceClient();
  const bucketName = bucket === "uploads" ? UPLOADS_BUCKET : OUTPUTS_BUCKET;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(
  path: string,
  bucket: "uploads" | "outputs" = "outputs",
  expiresInSeconds = 3600
): Promise<{ signedUrl: string; expiresAt: string }> {
  const supabase = createServiceClient();
  const bucketName = bucket === "uploads" ? UPLOADS_BUCKET : OUTPUTS_BUCKET;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return { signedUrl: data.signedUrl, expiresAt };
}

export async function downloadFromStorage(
  path: string,
  bucket: "uploads" | "outputs" = "uploads"
): Promise<ArrayBuffer> {
  const supabase = createServiceClient();
  const bucketName = bucket === "uploads" ? UPLOADS_BUCKET : OUTPUTS_BUCKET;

  const { data, error } = await supabase.storage.from(bucketName).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return data.arrayBuffer();
}

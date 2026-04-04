"use client";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDistanceToNow, format } from "date-fns";
import { Download, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { JobDetailResponse } from "@/types";

export function JobDetailCard({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchJob = async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) setJob(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchJob();
    const interval = setInterval(() => {
      if (job?.status && ["processing", "queued"].includes(job.status)) {
        fetchJob();
      }
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/download/${jobId}`);
      if (!res.ok) throw new Error("Failed to get download link");
      const { signed_url, file_name } = await res.json();
      const a = document.createElement("a");
      a.href = signed_url;
      a.download = file_name;
      a.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/process/${jobId}`, { method: "POST" });
      if (!res.ok) throw new Error("Retry failed");
      toast.success("Job re-queued successfully");
      await fetchJob();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card p-8 text-center text-red-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Job not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {job.transcript_file?.original_name ?? "Job"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Created {format(new Date(job.created_at), "PPP 'at' p")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={job.status} />
            {job.status === "completed" && (
              <button onClick={handleDownload} disabled={downloading} className="btn-primary">
                {downloading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Excel
              </button>
            )}
            {job.status === "failed" && (
              <button onClick={handleRetry} disabled={retrying} className="btn-secondary">
                {retrying ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Retry"}
              </button>
            )}
          </div>
        </div>

        {job.error_message && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{job.error_message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Files */}
      <div className="card p-6">
        <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Files</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Transcript</p>
            <p className="text-sm font-medium mt-1">{job.transcript_file?.original_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {job.transcript_file?.size_bytes
                ? `${(job.transcript_file.size_bytes / 1024).toFixed(1)} KB`
                : "—"}
            </p>
          </div>
          {job.template_file && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase">Template</p>
              <p className="text-sm font-medium mt-1">{job.template_file.original_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{job.template?.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Event log */}
      {job.events && job.events.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
            Processing Log
          </h2>
          <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-4 ml-2">
            {job.events.map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 bg-blue-500" />
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ev.message}</p>
                <p className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Extracted summary preview */}
      {job.ai_raw_json && (
        <div className="card p-6">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
            Extracted Summary
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ["Meeting Title", job.ai_raw_json.meeting_title],
              ["Date", job.ai_raw_json.meeting_date],
              ["Time", job.ai_raw_json.meeting_time],
              ["Location", job.ai_raw_json.location_or_platform],
              ["Facilitator", job.ai_raw_json.facilitator],
              ["Attendees", String(job.ai_raw_json.attendees?.length ?? 0)],
              ["Action Items", String(job.ai_raw_json.action_items?.length ?? 0)],
              ["Discussion Topics", String(job.ai_raw_json.discussion_summary?.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {job.ai_raw_json.action_items && job.ai_raw_json.action_items.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">Action Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      {["Action", "Owner", "Due Date", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 text-xs">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {job.ai_raw_json.action_items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2">{item.action}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.owner}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.due_date}</td>
                        <td className="px-3 py-2">{item.status_remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

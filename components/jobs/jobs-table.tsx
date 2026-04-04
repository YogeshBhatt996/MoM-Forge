"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DBJob, DBFile } from "@/types";
import { RefreshCw } from "lucide-react";

type JobRow = DBJob & { transcript_file: DBFile };

export function JobsTable() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const { jobs } = await res.json();
      setJobs(jobs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll every 10 seconds if any job is in-progress
    const interval = setInterval(() => {
      fetchJobs();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="card p-12 text-center text-gray-500">
        <p className="text-lg font-medium">No jobs yet</p>
        <p className="text-sm mt-1">Upload a transcript to generate your first MoM.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Recent Jobs</h2>
        <button onClick={fetchJobs} className="text-gray-400 hover:text-gray-600 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Transcript</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[220px] truncate">
                  {job.transcript_file?.original_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

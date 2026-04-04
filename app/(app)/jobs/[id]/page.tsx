import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JobDetailCard } from "@/components/jobs/job-detail-card";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Job Details</h1>
      <JobDetailCard jobId={id} />
    </div>
  );
}

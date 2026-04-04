import { JobsTable } from "@/components/jobs/jobs-table";

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Jobs</h1>
        <p className="text-gray-500 mt-1">A full history of your MoM generation jobs.</p>
      </div>
      <JobsTable />
    </div>
  );
}

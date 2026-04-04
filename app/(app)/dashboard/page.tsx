import { createClient } from "@/lib/supabase/server";
import { UploadWizard } from "@/components/upload/upload-wizard";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Zap } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hi, {firstName} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Upload a transcript and template to generate structured meeting minutes.
        </p>
      </div>

      {/* Upload wizard */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Generate MoM</h2>
        </div>
        <div className="card p-6">
          <UploadWizard />
        </div>
      </section>

      {/* Recent jobs */}
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Jobs</h2>
        <JobsTable />
      </section>
    </div>
  );
}

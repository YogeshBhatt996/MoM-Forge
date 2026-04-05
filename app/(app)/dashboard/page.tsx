import { createClient } from "@/lib/supabase/server";
import { UploadWizard } from "@/components/upload/upload-wizard";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Zap, FileText, FileSpreadsheet, Info, Lightbulb } from "lucide-react";

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
          Turn any meeting transcript into structured, professional minutes — in seconds.
        </p>
      </div>

      {/* How it works — quick guide */}
      <section className="grid sm:grid-cols-2 gap-4">
        {/* Card 1 — Transcript (required) */}
        <div className="flex gap-3 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-4">
          <div className="shrink-0 mt-0.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">1</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-600" />
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Upload your meeting transcript</p>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-blue-600 px-1.5 py-0.5 rounded-full">Required</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Paste or upload your transcript as a <strong>.txt</strong>, <strong>.pdf</strong>, or <strong>.docx</strong> file. This is the only file you must provide — everything else is optional.
            </p>
          </div>
        </div>

        {/* Card 2 — Template (optional) */}
        <div className="flex gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-4 py-4">
          <div className="shrink-0 mt-0.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-sm font-bold">2</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-gray-500" />
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Add a reference template</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">Optional</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Upload an <strong>.xlsx</strong>, <strong>.docx</strong>, or <strong>.pdf</strong> template if you want the output to match your organisation&apos;s format. Skip it and you&apos;ll automatically receive a beautifully formatted <strong>Word document</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Tip banner */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-4 py-3">
        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">Pro tip:</span> Save a frequently used template in the{" "}
          <a href="/templates" className="underline underline-offset-2 font-semibold">Template Library</a>{" "}
          and set it as your default — it will be automatically selected every time you generate a MoM.
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

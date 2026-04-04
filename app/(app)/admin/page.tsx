import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldCheck, Users, FileText, Cpu } from "lucide-react";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Placeholder: check admin role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform-wide settings and monitoring.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total Users", value: "—", color: "text-blue-600" },
          { icon: FileText, label: "Total Jobs", value: "—", color: "text-green-600" },
          { icon: Cpu, label: "Active Provider", value: process.env.AI_PROVIDER ?? "openai", color: "text-purple-600" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-5">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Prompt Versions</h2>
        <p className="text-sm text-gray-500">
          Manage active prompt templates used for AI extraction. This panel is a placeholder —
          implement full CRUD using the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">prompt_versions</code> table.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">System Health</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {["Supabase DB", "Supabase Storage", "AI Provider", "Excel Generator"].map((service) => (
            <div key={service} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{service}</span>
              <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Operational
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

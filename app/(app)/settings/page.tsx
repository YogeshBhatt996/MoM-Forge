"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "");
        setName(user.user_metadata?.full_name ?? "");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <section className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={email} disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </form>
      </section>

      {/* AI Provider info */}
      <section className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-2">AI Provider</h2>
        <p className="text-sm text-gray-500">
          The AI provider is configured via environment variables on the server.
          Contact your administrator to change the model or provider.
        </p>
        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
          AI_PROVIDER = {process.env.NEXT_PUBLIC_AI_PROVIDER ?? "openai"}
        </div>
      </section>

      {/* Danger zone */}
      <section className="card p-6 border-red-200 dark:border-red-900">
        <h2 className="font-semibold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deleting your account will permanently remove all your jobs, templates, and files.
          This cannot be undone.
        </p>
        <button
          onClick={() => toast.error("Account deletion — contact support.")}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition"
        >
          Delete account
        </button>
      </section>
    </div>
  );
}

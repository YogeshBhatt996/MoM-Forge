"use client";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { BookTemplate, Sheet, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  file: { original_name: string; size_bytes: number } | null;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    const { templates } = await res.json();
    setTemplates(templates ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSetDefault = async (id: string) => {
    const res = await fetch(`/api/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_default: true }),
    });
    if (res.ok) {
      toast.success("Default template updated");
      fetchTemplates();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template Library</h1>
          <p className="text-gray-500 mt-1">
            Manage your saved Excel MoM templates. Templates are saved automatically when you generate a MoM.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <BookTemplate className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Templates are saved automatically when you upload one during job creation.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className={`card p-5 relative ${tmpl.is_default ? "ring-2 ring-blue-500" : ""}`}>
              {tmpl.is_default && (
                <span className="absolute top-3 right-3 badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <Star className="w-3 h-3" /> Default
                </span>
              )}
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <Sheet className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{tmpl.name}</h3>
              {tmpl.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tmpl.description}</p>
              )}
              {tmpl.file && (
                <p className="text-xs text-gray-400 mt-1">{tmpl.file.original_name}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Added {formatDistanceToNow(new Date(tmpl.created_at), { addSuffix: true })}
              </p>
              {!tmpl.is_default && (
                <button
                  onClick={() => handleSetDefault(tmpl.id)}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

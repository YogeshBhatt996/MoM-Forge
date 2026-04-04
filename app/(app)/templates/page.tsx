"use client";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { BookTemplate, Sheet, FileText, Trash2, Star, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  file: { original_name: string; size_bytes: number; mime_type: string } | null;
}

function templateIcon(mimeType?: string) {
  if (!mimeType) return <Sheet className="w-4 h-4 text-green-600" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <Sheet className="w-4 h-4 text-green-600" />;
  return <FileText className="w-4 h-4 text-blue-600" />;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    const { templates } = await res.json();
    setTemplates(templates ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name.replace(/\.(xlsx|docx|pdf)$/i, ""));
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Upload failed");
      }
      toast.success("Template uploaded");
      await fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (id: string, enable = true) => {
    setSettingDefaultId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: enable }),
      });
      if (!res.ok) throw new Error("Failed to update default");
      toast.success(enable ? "Default template set" : "Default template removed");
      await fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Template deleted");
      setTemplates((t) => t.filter((tmpl) => tmpl.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template Library</h1>
          <p className="text-gray-500 mt-1">
            Manage your MoM templates. Templates are saved when you upload one during job creation, or you can upload directly here.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.docx,.pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Template
          </button>
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
          <p className="text-sm mt-1">Upload a template (.xlsx, .docx, .pdf) to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className={`card p-5 relative ${tmpl.is_default ? "ring-2 ring-blue-500" : ""}`}>
              {tmpl.is_default && (
                <span className="absolute top-3 right-10 badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Default
                </span>
              )}
              <button
                onClick={() => handleDelete(tmpl.id)}
                disabled={deletingId === tmpl.id}
                className="absolute top-3 right-3 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                title="Delete template"
              >
                {deletingId === tmpl.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>

              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                {templateIcon(tmpl.file?.mime_type)}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white truncate pr-8">{tmpl.name}</h3>
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
                  disabled={settingDefaultId === tmpl.id}
                  className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  {settingDefaultId === tmpl.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Star className="w-3 h-3" />
                  )}
                  Set as default
                </button>
              )}
              {tmpl.is_default && (
                <button
                  onClick={() => handleSetDefault(tmpl.id, false)}
                  disabled={settingDefaultId === tmpl.id}
                  className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Remove default
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

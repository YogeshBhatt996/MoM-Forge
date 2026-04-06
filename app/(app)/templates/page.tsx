"use client";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { BookTemplate, Sheet, FileText, Star, Upload, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const MAX_TEMPLATES = 5;
const WARN_AT = 3; // show confirmation when going from 3 → 4

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

interface ConfirmDialogProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ count, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Library getting full</h2>
            <p className="text-sm text-gray-500 mt-1">
              You already have <span className="font-semibold text-gray-800 dark:text-gray-200">{count} templates</span>.
              Adding more may make it harder to manage your library. Consider removing older or unused templates first.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              You can still upload this template, but your library is limited to {MAX_TEMPLATES} total.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="btn-secondary text-sm">
            Cancel & review
          </button>
          <button onClick={onConfirm} className="btn-primary text-sm">
            Upload anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    const { templates } = await res.json();
    setTemplates(templates ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const doUpload = async (file: File) => {
    setUploading(true);
    setPendingFile(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (templates.length >= MAX_TEMPLATES) {
      toast.error(`Maximum ${MAX_TEMPLATES} templates allowed. Please delete one first.`);
      return;
    }

    if (templates.length >= WARN_AT) {
      // Show confirmation dialog — user is uploading 4th or 5th
      setPendingFile(file);
      return;
    }

    doUpload(file);
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

  const atLimit = templates.length >= MAX_TEMPLATES;

  return (
    <div className="space-y-6">
      {/* Confirmation dialog */}
      {pendingFile && (
        <ConfirmDialog
          count={templates.length}
          onConfirm={() => doUpload(pendingFile)}
          onCancel={() => setPendingFile(null)}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template Library</h1>
          <p className="text-gray-500 mt-1">
            Manage your MoM templates. Templates are saved when you upload one during job creation, or you can upload directly here.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.docx,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || atLimit}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={atLimit ? `Maximum ${MAX_TEMPLATES} templates reached` : undefined}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Template
          </button>
          <p className="text-xs text-gray-400">
            {templates.length} / {MAX_TEMPLATES} templates
          </p>
        </div>
      </div>

      {atLimit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Template limit reached ({MAX_TEMPLATES}/{MAX_TEMPLATES}). Delete an existing template to upload a new one.
          </p>
        </div>
      )}

      {/* ── Default Template Selector ─────────────────────────────────────── */}
      {!loading && templates.length > 0 && (() => {
        const current = templates.find((t) => t.is_default);
        return (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Active Default Template</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically pre-selected when you generate a new MoM on the Dashboard.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Current default display */}
                {current ? (
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                    {templateIcon(current.file?.mime_type)}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{current.name}</p>
                      {current.file && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{current.file.original_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSetDefault(current.id, false)}
                      disabled={settingDefaultId === current.id}
                      className="ml-1 rounded-full p-0.5 text-gray-400 hover:text-red-500 transition"
                      title="Remove default"
                    >
                      {settingDefaultId === current.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">No default set</span>
                )}

                {/* Dropdown to change default */}
                <div className="relative">
                  <select
                    className="input text-sm pr-8 py-2 cursor-pointer"
                    value={current?.id ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleSetDefault(val, true);
                    }}
                    disabled={!!settingDefaultId}
                  >
                    <option value="">— Change default —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.is_default ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Template Cards ────────────────────────────────────────────────── */}
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
              {!tmpl.is_default ? (
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
              ) : (
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

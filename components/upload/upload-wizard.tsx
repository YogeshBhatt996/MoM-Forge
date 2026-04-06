"use client";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText, Sheet, X, ArrowRight, Loader2, CheckCircle2,
  Star, Info, Upload, Calendar, Tag, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Step = "files" | "processing" | "done";

interface FileState {
  transcript: File | null;
  template: File | null;
}

interface DefaultTemplate {
  id: string;
  name: string;
  file: { original_name: string } | null;
}

// ── Generate 2-3 title suggestions from a transcript filename ──────────────
function buildSuggestions(filename: string): string[] {
  const base = filename
    .replace(/\.(txt|pdf|docx)$/i, "")
    .replace(/[_\-\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const toTitle = (s: string) =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const full = toTitle(base);
  const words = full.split(" ").filter(Boolean);

  const suggestions: string[] = [full];

  // Variant: first 4 words
  if (words.length > 4) {
    suggestions.push(words.slice(0, 4).join(" "));
  }

  // Variant: strip trailing year/number (e.g. "Q1 2026")
  const stripped = words
    .filter((w, i) => !(i >= words.length - 2 && /^\d{1,4}$/.test(w)))
    .join(" ");
  if (stripped && stripped !== full && stripped !== suggestions[1]) {
    suggestions.push(stripped);
  }

  return [...new Set(suggestions)].filter((s) => s.length > 0).slice(0, 3);
}

function FileDrop({
  label, accept, file, onDrop, onClear, icon: Icon, optional,
}: {
  label: string;
  accept: Record<string, string[]>;
  file: File | null;
  onDrop: (f: File) => void;
  onClear: () => void;
  icon: React.ElementType;
  optional?: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted[0] && onDrop(accepted[0]),
    accept,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer
        ${isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 hover:border-blue-400 dark:border-gray-700"}
        ${file ? "border-green-400 bg-green-50 dark:bg-green-950/30" : ""}`}
    >
      <input {...getInputProps()} />
      {file ? (
        <>
          <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 text-center break-all">{file.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute top-2 right-2 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <Icon className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          {optional && (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              Optional
            </span>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {isDragActive ? "Drop it here" : "Drag & drop or click to browse"}
          </p>
        </>
      )}
    </div>
  );
}

export function UploadWizard() {
  const [files, setFiles] = useState<FileState>({ transcript: null, template: null });
  const [step, setStep] = useState<Step>("files");
  const [jobId, setJobId] = useState<string | null>(null);
  const [defaultTemplate, setDefaultTemplate] = useState<DefaultTemplate | null>(null);
  // "default" | "upload" | "none"
  const [templateChoice, setTemplateChoice] = useState<"default" | "upload" | "none">("none");

  // New: meeting date (above transcript) and title (below transcript)
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);

  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : { templates: [] })
      .then(({ templates }) => {
        const def = (templates ?? []).find((t: { is_default?: boolean }) => t.is_default);
        if (def) {
          setDefaultTemplate(def as DefaultTemplate);
          setTemplateChoice("default"); // auto-select default if one exists
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  // When transcript file changes, generate suggestions from filename
  useEffect(() => {
    if (files.transcript) {
      const suggestions = buildSuggestions(files.transcript.name);
      setTitleSuggestions(suggestions);
      // Auto-fill with first suggestion if field is empty
      if (!meetingTitle) setMeetingTitle(suggestions[0] ?? "");
    } else {
      setTitleSuggestions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.transcript]);

  const handleSubmit = useCallback(async () => {
    if (!files.transcript) {
      toast.error("Please select a meeting transcript.");
      return;
    }

    setStep("processing");

    try {
      const fd = new FormData();
      fd.append("transcript", files.transcript);

      if (templateChoice === "default" && defaultTemplate) {
        fd.append("existing_template_id", defaultTemplate.id);
      } else if (templateChoice === "upload" && files.template) {
        fd.append("template", files.template);
      }
      // "none" → Word doc auto-generated

      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const { error } = await uploadRes.json();
        throw new Error(error || "Upload failed");
      }
      const { transcript_file_id, template_file_id, template_id } = await uploadRes.json();

      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_file_id,
          template_file_id,
          template_id,
          meeting_title_hint: meetingTitle.trim() || null,
          meeting_date_hint: meetingDate || null,
        }),
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      const { job_id } = await jobRes.json();
      setJobId(job_id);

      const processRes = await fetch(`/api/process/${job_id}`, { method: "POST" });
      if (!processRes.ok) {
        const { error } = await processRes.json();
        throw new Error(error || "Processing failed");
      }

      setStep("done");
      toast.success("Minutes generated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setStep("files");
    }
  }, [files, templateChoice, defaultTemplate, meetingTitle, meetingDate]);

  if (step === "done" && jobId) {
    return (
      <div className="flex flex-col items-center py-12 gap-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Minutes Ready!</h2>
          <p className="text-gray-500 mt-1">Your MoM has been generated and is ready to download.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push(`/jobs/${jobId}`)} className="btn-primary">View & Download</button>
          <button
            onClick={() => {
              setFiles({ transcript: null, template: null });
              setJobId(null);
              setStep("files");
              setMeetingTitle("");
              setMeetingDate("");
              setTitleSuggestions([]);
              setTemplateChoice(defaultTemplate ? "default" : "none");
            }}
            className="btn-secondary"
          >
            New Job
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Processing your transcript…</h2>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          AI is extracting and structuring your meeting minutes. This usually takes under a minute.
        </p>
        <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  const noTemplate = !useDefault && !files.template;

  return (
    <div className="space-y-5">
      {/* Hint banner */}
      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <span className="font-semibold">Only the transcript is required.</span> Optionally add a reference template (.xlsx / .docx / .pdf) to match your organisation&apos;s format — or skip it and receive a professionally formatted Word document automatically.
        </p>
      </div>

      {/* ── Meeting Date ── ABOVE transcript ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <p className="label">Meeting Date</p>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Optional</span>
        </div>
        <input
          type="date"
          min="2026-01-01"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          className="input w-full sm:w-56"
          placeholder="Select meeting date"
        />
        <p className="text-xs text-gray-400 mt-1">
          Select the date the meeting took place. If left blank, today&apos;s date or the date from the transcript will be used.
        </p>
      </div>

      {/* ── Upload row ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Transcript column */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="label">Meeting Transcript</p>
            <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-blue-600 px-2 py-0.5 rounded-full">Required</span>
          </div>
          <FileDrop
            label="Upload transcript (.txt, .pdf, .docx)"
            accept={{
              "text/plain": [".txt"],
              "application/pdf": [".pdf"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            }}
            file={files.transcript}
            onDrop={(f) => setFiles((s) => ({ ...s, transcript: f }))}
            onClear={() => {
              setFiles((s) => ({ ...s, transcript: null }));
              setMeetingTitle("");
              setTitleSuggestions([]);
            }}
            icon={FileText}
          />

          {/* ── Meeting Title ── BELOW transcript drop zone ── */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Meeting Title</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">Optional</span>
            </div>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g. Q1 Strategy Review"
              className="input w-full text-sm"
              maxLength={200}
            />

            {/* Auto-suggestions */}
            {titleSuggestions.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <p className="text-[10px] text-gray-400 font-medium">Suggestions based on filename:</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {titleSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMeetingTitle(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                        ${meetingTitle === s
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!files.transcript && (
              <p className="text-[11px] text-gray-400 mt-1.5">Upload a transcript to see title suggestions.</p>
            )}
          </div>
        </div>

        {/* Template column */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="label">MoM Template</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Optional</span>
          </div>

          <div className="space-y-2">
            {/* ── Option 1: Use Default Template ── */}
            <button
              type="button"
              disabled={!defaultTemplate}
              onClick={() => {
                if (!defaultTemplate) return;
                setTemplateChoice((c) => c === "default" ? "none" : "default");
                setFiles((s) => ({ ...s, template: null }));
              }}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all
                ${!defaultTemplate
                  ? "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 opacity-50 cursor-not-allowed"
                  : templateChoice === "default"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-900"
                }`}
            >
              <div className="flex items-center gap-3">
                {/* Radio indicator */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                  ${!defaultTemplate
                    ? "border-gray-300 dark:border-gray-700"
                    : templateChoice === "default"
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}>
                  {templateChoice === "default" && defaultTemplate && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <Star className={`w-4 h-4 shrink-0 ${!defaultTemplate ? "text-gray-300 dark:text-gray-700" : templateChoice === "default" ? "text-blue-500" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${!defaultTemplate ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}`}>
                    Use Default Template
                  </p>
                  {defaultTemplate ? (
                    <p className="text-xs text-gray-500 truncate">{defaultTemplate.name}{defaultTemplate.file ? ` · ${defaultTemplate.file.original_name}` : ""}</p>
                  ) : (
                    <p className="text-xs text-gray-400">No default set — go to Template Library to set one</p>
                  )}
                </div>
              </div>
            </button>

            {/* ── Option 2: Upload Template ── */}
            <div
              className={`rounded-xl border-2 transition-all
                ${templateChoice === "upload"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}
            >
              <button
                type="button"
                onClick={() => {
                  setTemplateChoice((c) => c === "upload" ? "none" : "upload");
                }}
                className="w-full text-left px-4 pt-3 pb-2"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${templateChoice === "upload" ? "border-blue-600 bg-blue-600" : "border-gray-300 dark:border-gray-600"}`}>
                    {templateChoice === "upload" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <Upload className={`w-4 h-4 shrink-0 ${templateChoice === "upload" ? "text-blue-500" : "text-gray-400"}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Upload Template</p>
                    <p className="text-xs text-gray-500">Use a one-off .xlsx, .docx or .pdf file</p>
                  </div>
                </div>
              </button>

              {/* File drop zone — only shown when this option is selected */}
              {templateChoice === "upload" && (
                <div className="px-3 pb-3">
                  <FileDrop
                    label="Upload template (.xlsx, .docx, .pdf)"
                    accept={{
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                      "application/pdf": [".pdf"],
                    }}
                    file={files.template}
                    onDrop={(f) => setFiles((s) => ({ ...s, template: f }))}
                    onClear={() => setFiles((s) => ({ ...s, template: null }))}
                    icon={Sheet}
                    optional
                  />
                </div>
              )}
            </div>

            {/* No-template hint */}
            {templateChoice === "none" && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
                <Upload className="w-3 h-3 shrink-0" />
                No template selected — a professionally formatted Word document will be generated.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Output name preview */}
        {(meetingTitle || meetingDate) && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <FileText className="w-3 h-3 shrink-0" />
            Output:{" "}
            <span className="font-medium text-gray-600 dark:text-gray-300">
              MoM_{(meetingTitle || "Meeting").replace(/\s+/g, "_")}_{meetingDate || "date"}.{noTemplate ? "docx" : "xlsx"}
            </span>
          </p>
        )}
        <div className="ml-auto">
          <button
            onClick={handleSubmit}
            disabled={!files.transcript}
            className="btn-primary"
          >
            Generate MoM <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, Sheet, X, ArrowRight, Loader2, CheckCircle2, Star } from "lucide-react";
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

function FileDrop({
  label,
  accept,
  file,
  onDrop,
  onClear,
  icon: Icon,
}: {
  label: string;
  accept: Record<string, string[]>;
  file: File | null;
  onDrop: (f: File) => void;
  onClear: () => void;
  icon: React.ElementType;
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
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 text-center break-all">
            {file.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {(file.size / 1024).toFixed(1)} KB
          </p>
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
  const [templateName, setTemplateName] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [defaultTemplate, setDefaultTemplate] = useState<DefaultTemplate | null>(null);
  const [useDefault, setUseDefault] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : { templates: [] })
      .then(({ templates }) => {
        const def = (templates as DefaultTemplate[] & { is_default?: boolean }[]).find(
          (t: { is_default?: boolean }) => t.is_default
        );
        if (def) {
          setDefaultTemplate(def as DefaultTemplate);
          setUseDefault(true);
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!files.transcript) {
      toast.error("Please select a transcript file.");
      return;
    }
    if (!useDefault && !files.template) {
      toast.error("Please select a template file or use the default template.");
      return;
    }

    setStep("processing");

    try {
      // Step 1: upload files
      const fd = new FormData();
      fd.append("transcript", files.transcript);

      if (useDefault && defaultTemplate) {
        fd.append("existing_template_id", defaultTemplate.id);
      } else if (files.template) {
        fd.append("template", files.template);
        fd.append("template_name", templateName || files.template.name.replace(/\.(xlsx|docx|pdf)$/i, ""));
      }

      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const { error } = await uploadRes.json();
        throw new Error(error || "Upload failed");
      }
      const { transcript_file_id, template_file_id, template_id } = await uploadRes.json();

      // Step 2: create job
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_file_id, template_file_id, template_id }),
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      const { job_id } = await jobRes.json();
      setJobId(job_id);

      // Step 3: process
      const processRes = await fetch(`/api/process/${job_id}`, { method: "POST" });
      if (!processRes.ok) {
        const { error } = await processRes.json();
        throw new Error(error || "Processing failed");
      }

      setStep("done");
      toast.success("Minutes generated successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setStep("files");
    }
  }, [files, templateName, useDefault, defaultTemplate]);

  if (step === "done" && jobId) {
    return (
      <div className="flex flex-col items-center py-12 gap-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Minutes Ready!</h2>
          <p className="text-gray-500 mt-1">Your MoM has been generated and is ready to download.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/jobs/${jobId}`)}
            className="btn-primary"
          >
            View & Download
          </button>
          <button
            onClick={() => {
              setFiles({ transcript: null, template: null });
              setTemplateName("");
              setJobId(null);
              setStep("files");
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
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Processing your transcript…
        </h2>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          AI is extracting and structuring your meeting minutes. This usually takes 15–45 seconds.
        </p>
        <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  const canSubmit = !!files.transcript && (useDefault ? !!defaultTemplate : !!files.template);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="label mb-2">Meeting Transcript</p>
          <FileDrop
            label="Upload transcript (.txt, .pdf, .docx)"
            accept={{
              "text/plain": [".txt"],
              "application/pdf": [".pdf"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            }}
            file={files.transcript}
            onDrop={(f) => setFiles((s) => ({ ...s, transcript: f }))}
            onClear={() => setFiles((s) => ({ ...s, transcript: null }))}
            icon={FileText}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label">MoM Template</p>
            {defaultTemplate && (
              <button
                type="button"
                onClick={() => {
                  setUseDefault((v) => !v);
                  if (!useDefault) setFiles((s) => ({ ...s, template: null }));
                }}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition
                  ${useDefault
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}
              >
                <Star className="w-3 h-3" />
                Use default
              </button>
            )}
          </div>
          {useDefault && defaultTemplate ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-6 gap-2">
              <Star className="w-7 h-7 text-blue-500" />
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 text-center">
                {defaultTemplate.name}
              </p>
              {defaultTemplate.file && (
                <p className="text-xs text-gray-500">{defaultTemplate.file.original_name}</p>
              )}
              <p className="text-xs text-blue-500">Default template selected</p>
            </div>
          ) : (
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
            />
          )}
        </div>
      </div>

      {!useDefault && (
        <div>
          <label className="label">Template name (optional)</label>
          <input
            className="input max-w-sm"
            placeholder="e.g. Q2 Planning Template"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary"
        >
          Generate MoM <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

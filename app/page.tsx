// Landing page
import Link from "next/link";
import { Zap, FileText, Sheet, Download, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Upload Any Transcript",
    description: "Supports .txt, .pdf, and .docx. Paste a Zoom recording or a hand-typed summary.",
  },
  {
    icon: Sheet,
    title: "Bring Your Own Template",
    description: "Upload your Excel MoM template. MoM Forge maps extracted data to your exact structure.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Extraction",
    description: "GPT-4o reads your transcript and extracts decisions, attendees, and action items — accurately.",
  },
  {
    icon: Download,
    title: "Download in Seconds",
    description: "Get a polished, formatted Excel file with every section filled in. Zero manual effort.",
  },
];

const steps = [
  { num: "01", title: "Upload", body: "Drop your meeting transcript and Excel template." },
  { num: "02", title: "Extract", body: "AI reads the transcript using your MoM rules." },
  { num: "03", title: "Map", body: "Data is mapped to the exact structure of your template." },
  { num: "04", title: "Download", body: "A formatted Excel file is ready in seconds." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
      {/* Nav */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">MoM Forge</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium mb-6">
          <Sparkles className="w-3 h-3" />
          AI-powered — no templates to learn
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          Turn any meeting transcript into a
          <span className="text-blue-600"> polished MoM</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Upload your transcript and reference template. MoM Forge extracts decisions, action items, and
          discussion summaries — then maps them into your exact format.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Generate your first MoM free <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/dashboard" className="btn-secondary px-6 py-3 text-base">
            Go to dashboard
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">No credit card required · 100% private</p>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white mb-12">
          How it works
        </h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
                {s.num}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white mb-12">
          Everything you need
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{f.title}</h3>
              <p className="text-sm text-gray-500 mt-2">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="card p-8 bg-blue-600 border-0 text-white">
          <h2 className="text-xl font-bold mb-4 text-center">What MoM Forge guarantees</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Never invents facts — missing fields say "Not specified in transcript"',
              "Action items always include: Action, Owner, Due Date, Status",
              "Summarises by topic, not by speaker",
              "Decisions are always traceable to transcript content",
              "Matches the exact column and sheet structure of your template",
              "Professional, concise language throughout",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Disclaimer banner */}
      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-5 py-4">
          <span className="text-amber-500 text-lg shrink-0 mt-0.5">⚠</span>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">AI-Generated Content Disclaimer —</span>{" "}
            MoM outputs are generated by artificial intelligence based on the provided meeting transcript.
            Users must review and verify all information — including names, dates, decisions, and action items —
            for accuracy and completeness before sharing on any platform or using for official purposes.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} MoM Forge · Built for teams that value clear documentation
      </footer>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode, demoLogin } from "@/lib/demo-auth";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isDemoMode()) {
        const { error } = demoLogin(email, password);
        if (error) { toast.error(error); return; }
        router.push("/dashboard");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }
      router.refresh();
      router.push("/dashboard");
    } catch {
      toast.error("Could not connect to auth service. Please check your configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f0f7ff 0%, #e8f0fe 50%, #f5f0ff 100%)" }}
    >
      {/* Background boardroom line-art watermark */}
      <svg
        viewBox="0 0 900 600"
        className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Room perspective */}
        <line x1="450" y1="200" x2="0" y2="600" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="450" y1="200" x2="900" y2="600" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="450" y1="200" x2="450" y2="0" stroke="#1e40af" strokeWidth="1" />
        <line x1="0" y1="400" x2="900" y2="400" stroke="#1e40af" strokeWidth="1" />
        <line x1="0" y1="500" x2="900" y2="500" stroke="#1e40af" strokeWidth="0.5" />
        {/* Conference table */}
        <ellipse cx="450" cy="450" rx="300" ry="100" stroke="#1e40af" strokeWidth="2" />
        <line x1="150" y1="450" x2="150" y2="550" stroke="#1e40af" strokeWidth="2" />
        <line x1="750" y1="450" x2="750" y2="550" stroke="#1e40af" strokeWidth="2" />
        <line x1="150" y1="550" x2="750" y2="550" stroke="#1e40af" strokeWidth="2" />
        {/* Window */}
        <rect x="300" y="50" width="300" height="180" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="450" y1="50" x2="450" y2="230" stroke="#1e40af" strokeWidth="1" />
        <line x1="300" y1="140" x2="600" y2="140" stroke="#1e40af" strokeWidth="1" />
        {/* City skyline in window */}
        <rect x="320" y="130" width="20" height="95" fill="#1e40af" />
        <rect x="348" y="110" width="25" height="115" fill="#1e40af" />
        <rect x="381" y="120" width="18" height="105" fill="#1e40af" />
        <rect x="407" y="90" width="30" height="135" fill="#1e40af" />
        <rect x="445" y="100" width="22" height="125" fill="#1e40af" />
        <rect x="475" y="115" width="20" height="110" fill="#1e40af" />
        <rect x="503" y="105" width="28" height="120" fill="#1e40af" />
        <rect x="539" y="125" width="18" height="100" fill="#1e40af" />
        {/* Whiteboard */}
        <rect x="50" y="80" width="180" height="120" rx="4" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="70" y1="110" x2="210" y2="110" stroke="#1e40af" strokeWidth="1" />
        <polyline points="70,145 100,120 130,135 160,108 210,125" stroke="#1e40af" strokeWidth="2" />
        {/* People silhouettes */}
        <circle cx="280" cy="380" r="22" fill="#1e40af" />
        <rect x="262" y="402" width="36" height="50" rx="10" fill="#1e40af" />
        <circle cx="360" cy="360" r="22" fill="#1e40af" />
        <rect x="342" y="382" width="36" height="50" rx="10" fill="#1e40af" />
        <circle cx="450" cy="350" r="24" fill="#1e40af" />
        <rect x="431" y="374" width="38" height="52" rx="10" fill="#1e40af" />
        <circle cx="540" cy="360" r="22" fill="#1e40af" />
        <rect x="522" y="382" width="36" height="50" rx="10" fill="#1e40af" />
        <circle cx="620" cy="380" r="22" fill="#1e40af" />
        <rect x="602" y="402" width="36" height="50" rx="10" fill="#1e40af" />
      </svg>

      {/* Soft glow accents */}
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, #bfdbfe, transparent 70%)", opacity: 0.5 }} />
      <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, #ddd6fe, transparent 70%)", opacity: 0.4 }} />
      <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, #bae6fd, transparent 70%)", opacity: 0.3 }} />

      {/* Left panel — brand + value props */}
      <div className="hidden lg:flex flex-col justify-center w-[46%] px-16 relative z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">MoM Forge</span>
        </div>

        <h2 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Every meeting.<br />
          <span className="text-blue-600">Perfectly</span> documented.
        </h2>
        <p className="text-gray-500 text-base leading-relaxed mb-10">
          Upload your transcript. Get a structured, formatted minutes document in seconds — powered by AI.
        </p>

        <div className="space-y-3">
          {[
            { icon: "📋", text: "Action items auto-extracted" },
            { icon: "📊", text: "Excel & PDF export ready" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-xl px-4 py-3 border border-blue-100/60"
              style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)" }}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-blue-100/60 p-8 border border-blue-50">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">MoM Forge</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Zap, Loader2, ArrowLeft, Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("too many")) {
          setErrorMsg(
            "Too many reset requests. Please wait a few minutes before trying again."
          );
        } else if (msg.includes("user not found") || msg.includes("invalid email")) {
          // Don't leak whether the email exists — show the success state anyway
          setSent(true);
          startCooldown();
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      setSent(true);
      startCooldown();
    } catch {
      setErrorMsg("Could not connect to the auth service. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Reset link resent — check your inbox.");
      startCooldown();
    } catch {
      toast.error("Could not resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg,#f0f7ff 0%,#e8f0fe 50%,#f5f0ff 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="w-7 h-7 text-blue-600" />
            <span className="font-bold text-xl">MoM Forge</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
          <p className="text-gray-500 text-sm mt-1">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <div className="card p-6">
          {sent ? (
            /* ── Success state ── */
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">Check your inbox</p>
                <p className="text-sm text-gray-500">
                  We sent a password reset link to{" "}
                  <strong className="text-gray-800 dark:text-gray-200">{email}</strong>
                </p>
              </div>

              {/* Helpful tips */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-semibold">Didn&apos;t receive the email?</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                  <li>Check your <strong>Spam / Junk</strong> folder</li>
                  <li>The link expires in <strong>1 hour</strong></li>
                  <li>Allow 1–2 minutes for delivery</li>
                </ul>
              </div>

              {/* Resend button */}
              <button
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="btn-secondary w-full justify-center py-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend reset link"}
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="flex gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
                </div>
              )}
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send reset link
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

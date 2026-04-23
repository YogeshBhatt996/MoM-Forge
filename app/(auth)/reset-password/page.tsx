"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    // ── PKCE flow: link contains ?code= ──────────────────────────────────────
    const code = searchParams.get("code");
    if (code) {
      (async () => {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // Show the form anyway and let Supabase validate on submit
        } finally {
          setReady(true);
        }
      })();
      return;
    }

    // ── Implicit flow: link contains #access_token + type=recovery in hash ───
    // This fires when Supabase sends a link with hash params (older flow).
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
      return;
    }

    // ── Fallback: listen for PASSWORD_RECOVERY auth state event ──────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(error.message); return; }
      toast.success("Password updated successfully!");
      router.push("/dashboard");
    } catch {
      toast.error("Could not connect to auth service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      {!ready ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Verifying reset link…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Re-enter password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Update password
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:"linear-gradient(135deg,#f0f7ff 0%,#e8f0fe 50%,#f5f0ff 100%)"}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="w-7 h-7 text-blue-600" />
            <span className="font-bold text-xl">MoM Forge</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set new password</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a strong password for your account</p>
        </div>
        <Suspense fallback={
          <div className="card p-6 text-center py-4 text-gray-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

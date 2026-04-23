"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Clock } from "lucide-react";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;   // 60 minutes
const WARNING_BEFORE_MS     =  5 * 60 * 1000;   //  5 minutes before logout
const ACTIVITY_EVENTS       = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

export function InactivityGuard() {
  const router      = useRouter();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const [countdown, setCountdown] = useState(300); // seconds left in warning window
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnRef.current)  clearTimeout(warnRef.current);
    if (countRef.current) clearInterval(countRef.current);
    setShowWarn(false);

    // Warning fires 5 min before logout
    warnRef.current = setTimeout(() => {
      setShowWarn(true);
      setCountdown(WARNING_BEFORE_MS / 1000);
      countRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (countRef.current) clearInterval(countRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Actual logout
    timerRef.current = setTimeout(() => {
      signOut();
    }, INACTIVITY_TIMEOUT_MS);
  }, [signOut]);

  useEffect(() => {
    resetTimers();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetTimers, { passive: true })
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current)  clearTimeout(warnRef.current);
      if (countRef.current) clearInterval(countRef.current);
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, resetTimers)
      );
    };
  }, [resetTimers]);

  if (!showWarn) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownLabel = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, "0")}s`
    : `${secs}s`;

  return (
    /* Fixed warning banner at the bottom of the screen */
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-start gap-3 max-w-lg w-full rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 shadow-xl px-5 py-4">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Session expiring due to inactivity
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            You will be automatically signed out in{" "}
            <span className="font-bold tabular-nums">{countdownLabel}</span>.
            Move your mouse or press any key to stay signed in.
          </p>
        </div>
        <button
          onClick={resetTimers}
          className="shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          Stay signed in
        </button>
        <button
          onClick={signOut}
          className="shrink-0 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 px-2 py-1.5 rounded-lg transition-colors"
          title="Sign out now"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

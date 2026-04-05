"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, Activity, Database, HardDrive, Zap, Users,
  CheckCircle2, XCircle, Clock, RefreshCw, ArrowRight, AlertTriangle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DbHealth { ok: boolean; latencyMs: number; error?: string }
interface StorageHealth { ok: boolean; latencyMs: number; error?: string }
interface VercelDeployment {
  uid: string;
  name: string;
  state: string;
  target: string;
  created: number;
  url: string;
}
interface VercelHealth {
  available: boolean;
  reason?: string;
  deployments?: VercelDeployment[];
}
interface HealthData {
  db: DbHealth;
  storage: StorageHealth;
  vercel: VercelHealth;
  checkedAt: string;
}
interface StatsData {
  users: { total: number; active30d: number };
  jobs: { total: number; completed: number; failed: number; processing: number; successRate: number | null; errorRate: number | null };
  templates: { total: number };
  files: { total: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const deploymentStateColors: Record<string, string> = {
  READY: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400",
  ERROR: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  BUILDING: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400",
  QUEUED: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400",
  CANCELED: "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  FAILED: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  DISABLED: "text-gray-500 bg-gray-100 dark:bg-gray-800",
};

function DeployStateBadge({ state }: { state: string }) {
  const cls = deploymentStateColors[state] ?? deploymentStateColors.DISABLED;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{state}</span>
  );
}

function HealthBadge({ ok, latencyMs }: { ok: boolean; latencyMs: number }) {
  return ok ? (
    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
      <CheckCircle2 className="w-4 h-4" /> OK · {latencyMs}ms
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
      <XCircle className="w-4 h-4" /> Down
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "blue" | "green" | "red" | "amber";
}) {
  const colorMap = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600",
    red: "bg-red-100 dark:bg-red-900/30 text-red-500",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600",
  };
  return (
    <div className="card p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const [hr, sr] = await Promise.all([
      fetch("/api/admin/health").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/stats").then((r) => r.json()).catch(() => null),
    ]);
    setHealth(hr);
    setStats(sr);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const latestDeployment = health?.vercel?.deployments?.[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            {health?.checkedAt && (
              <p className="text-xs text-gray-400">
                Last refreshed {new Date(health.checkedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={refreshing} className="btn-secondary text-sm">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href="/admin/users" className="btn-primary text-sm">
            <Users className="w-4 h-4" /> Manage Users <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total users" value={stats?.users.total ?? "—"}
              sub={`${stats?.users.active30d ?? 0} active (30d)`} color="blue" />
            <StatCard icon={Activity} label="Total jobs" value={stats?.jobs.total ?? "—"}
              sub={`${stats?.jobs.completed ?? 0} completed`} color="green" />
            <StatCard icon={CheckCircle2} label="Success rate"
              value={stats?.jobs.successRate != null ? `${stats.jobs.successRate}%` : "—"}
              sub={`${stats?.jobs.failed ?? 0} failed jobs`}
              color={(stats?.jobs.successRate ?? 100) < 80 ? "red" : "green"} />
            <StatCard icon={HardDrive} label="Files stored" value={stats?.files.total ?? "—"}
              sub={`${stats?.templates.total ?? 0} templates`} color="amber" />
          </div>

          {/* System Health */}
          <div className="card p-6">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
              System Health
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Database className="w-4 h-4" /> Database (Supabase)
                </div>
                {health?.db ? (
                  <HealthBadge ok={health.db.ok} latencyMs={health.db.latencyMs} />
                ) : <span className="text-gray-400 text-sm">—</span>}
                {health?.db?.error && (
                  <p className="text-xs text-red-500">{health.db.error}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <HardDrive className="w-4 h-4" /> Storage (Supabase)
                </div>
                {health?.storage ? (
                  <HealthBadge ok={health.storage.ok} latencyMs={health.storage.latencyMs} />
                ) : <span className="text-gray-400 text-sm">—</span>}
                {health?.storage?.error && (
                  <p className="text-xs text-red-500">{health.storage.error}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Zap className="w-4 h-4" /> AI Processing
                </div>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Derived from job success rate
                </span>
                {stats?.jobs.total ? (
                  <p className="text-xs text-gray-400">
                    {stats.jobs.successRate}% of {stats.jobs.total} jobs succeeded
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Vercel Deployment Status */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
                Deployment Status (Vercel)
              </h2>
              {latestDeployment && (
                <DeployStateBadge state={latestDeployment.state} />
              )}
            </div>
            {!health?.vercel?.available ? (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Vercel API not connected</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {health?.vercel?.reason ?? "Add VERCEL_TOKEN to environment variables to see live deployment status."}
                  </p>
                </div>
              </div>
            ) : health?.vercel?.deployments?.length === 0 ? (
              <p className="text-sm text-gray-500">No deployments found.</p>
            ) : (
              <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                {(health?.vercel?.deployments ?? []).slice(0, 5).map((dep) => (
                  <div key={dep.uid} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {dep.url}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {new Date(dep.created).toLocaleString()}
                        </span>
                        {dep.target && (
                          <span className="text-xs text-gray-400 capitalize">· {dep.target}</span>
                        )}
                      </div>
                    </div>
                    <DeployStateBadge state={dep.state} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Indicators */}
          <div className="card p-6">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
              Performance Indicators
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "DB Response Time",
                  value: health?.db?.latencyMs != null ? `${health.db.latencyMs}ms` : "—",
                  status: health?.db?.latencyMs != null
                    ? health.db.latencyMs < 200 ? "good" : health.db.latencyMs < 500 ? "warn" : "bad"
                    : "unknown",
                },
                {
                  label: "Storage Response Time",
                  value: health?.storage?.latencyMs != null ? `${health.storage.latencyMs}ms` : "—",
                  status: health?.storage?.latencyMs != null
                    ? health.storage.latencyMs < 300 ? "good" : health.storage.latencyMs < 700 ? "warn" : "bad"
                    : "unknown",
                },
                {
                  label: "Job Success Rate",
                  value: stats?.jobs.successRate != null ? `${stats.jobs.successRate}%` : "—",
                  status: stats?.jobs.successRate != null
                    ? stats.jobs.successRate >= 90 ? "good" : stats.jobs.successRate >= 70 ? "warn" : "bad"
                    : "unknown",
                },
                {
                  label: "Job Error Rate",
                  value: stats?.jobs.errorRate != null ? `${stats.jobs.errorRate}%` : "—",
                  status: stats?.jobs.errorRate != null
                    ? stats.jobs.errorRate <= 5 ? "good" : stats.jobs.errorRate <= 20 ? "warn" : "bad"
                    : "unknown",
                },
              ].map(({ label, value, status }) => {
                const statusColor = { good: "text-green-600", warn: "text-amber-600", bad: "text-red-500", unknown: "text-gray-400" }[status];
                const dot = { good: "bg-green-500", warn: "bg-amber-500", bad: "bg-red-500", unknown: "bg-gray-300" }[status];
                return (
                  <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                    <p className={`text-xl font-bold ${statusColor}`}>{value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

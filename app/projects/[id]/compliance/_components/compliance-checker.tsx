"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "YOUTUBE_SHORTS" | "INSTAGRAM_REELS" | "TIKTOK" | "YOUTUBE_STANDARD";
type CheckStatus = "pass" | "warn" | "fail";

interface ComplianceCheck {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  details: string[];
}

interface ComplianceReport {
  projectId: string;
  platform: Platform;
  overallStatus: CheckStatus;
  checks: ComplianceCheck[];
  exportAllowed: boolean;
  totalDurationSec: number;
  generatedAt: string;
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "YOUTUBE_SHORTS", label: "YouTube Shorts" },
  { value: "INSTAGRAM_REELS", label: "Instagram Reels" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE_STANDARD", label: "YouTube" },
];

// ─── Status UI ────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "warn") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const styles: Record<CheckStatus, string> = {
    pass: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-800",
    fail: "bg-red-100 text-red-800",
  };
  const labels: Record<CheckStatus, string> = {
    pass: "Pass",
    warn: "Warning",
    fail: "Fail",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Check card ───────────────────────────────────────────────────────────────

function CheckCard({ check }: { check: ComplianceCheck }) {
  const borderColors: Record<CheckStatus, string> = {
    pass: "border-green-200",
    warn: "border-amber-200",
    fail: "border-red-200",
  };
  const bgColors: Record<CheckStatus, string> = {
    pass: "bg-green-50",
    warn: "bg-amber-50",
    fail: "bg-red-50",
  };

  return (
    <div className={`rounded-lg border p-4 ${borderColors[check.status]} ${bgColors[check.status]}`}>
      <div className="flex items-start gap-3">
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{check.label}</span>
            <StatusBadge status={check.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
          {check.details.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {check.details.map((d, i) => (
                <li key={i} className="text-xs text-foreground/80">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overall status banner ────────────────────────────────────────────────────

function OverallBanner({ report }: { report: ComplianceReport }) {
  if (report.overallStatus === "pass") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4">
        <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">All checks passed — export is allowed</p>
          <p className="text-xs text-green-700 mt-0.5">
            Proceed to the Export page to assemble and download your video.
          </p>
        </div>
      </div>
    );
  }
  if (report.overallStatus === "warn") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
        <div>
          <p className="font-semibold text-amber-800">Warnings — export is allowed with caution</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Review the warnings below. Export is permitted but verify before publishing.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
      <XCircle className="h-6 w-6 text-red-600 shrink-0" />
      <div>
        <p className="font-semibold text-red-800">Export blocked — compliance failures detected</p>
        <p className="text-xs text-red-700 mt-0.5">
          Resolve all red checks before export is allowed.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceChecker({
  projectId,
  totalDurationSec,
}: {
  projectId: string;
  totalDurationSec: number;
}) {
  const [platform, setPlatform] = useState<Platform>("YOUTUBE_SHORTS");
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/compliance?platform=${platform}&durationSec=${totalDurationSec}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Compliance check failed");
      } else {
        setReport(json.data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [projectId, platform, totalDurationSec]);

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Target Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPlatform(p.value);
                  setReport(null);
                }}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  platform === p.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={runChecks} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {report ? "Re-run Checks" : "Run Compliance Check"}
            </Button>
            {report && (
              <span className="text-xs text-muted-foreground">
                Last run: {new Date(report.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Report */}
      {report && (
        <div className="space-y-4">
          <OverallBanner report={report} />

          <div className="space-y-3">
            {report.checks.map((check) => (
              <CheckCard key={check.id} check={check} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
            <div className="text-sm">
              <span className="font-medium">Content duration:</span>{" "}
              {report.totalDurationSec.toFixed(1)}s
              <span className="ml-2 text-muted-foreground">(+~8s for title cards & disclosure)</span>
            </div>
            {report.exportAllowed && (
              <Button size="sm" asChild variant="default">
                <a href={`/projects/${projectId}/export?platform=${platform}`}>
                  Go to Export →
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

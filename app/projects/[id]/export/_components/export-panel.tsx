"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  ClipboardCopy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Film,
  ShieldCheck,
} from "lucide-react";
// ─── Platform checklist (inlined from final-assembler for client-safe use) ────
function getPlatformChecklist(platform: Platform, projectName: string): string {
  const specLabels: Record<Platform, string> = {
    YOUTUBE_SHORTS: "YouTube Shorts",
    INSTAGRAM_REELS: "Instagram Reels",
    TIKTOK: "TikTok",
    YOUTUBE_STANDARD: "YouTube",
  };
  const common = [
    "☐ Title includes relevant keywords",
    "☐ Description mentions 'AI Generated Content' or 'Made with AI'",
    "☐ Add #AIGenerated hashtag",
    "☐ Enable 'Altered or synthetic media' disclosure in platform settings",
  ];
  const specific: Record<Platform, string[]> = {
    YOUTUBE_SHORTS: [
      "☐ Add #Shorts to title or description",
      "☐ Enable 'Made with AI' label in YouTube Studio → Edit → Details",
    ],
    INSTAGRAM_REELS: [
      "☐ Add 'AI generated' to caption",
      "☐ Use Instagram's 'AI-generated content' label (Advanced Settings)",
    ],
    TIKTOK: [
      "☐ Enable 'AI-generated content' toggle in Post Settings",
      "☐ Add #AIGenerated #AI to caption",
    ],
    YOUTUBE_STANDARD: [
      "☐ Enable 'Altered or synthetic media' in YouTube Studio → Edit → Details",
      "☐ Add AI disclosure to video description",
    ],
  };
  return [
    `Platform: ${specLabels[platform]}`,
    `Project: ${projectName}`,
    "",
    "Upload checklist:",
    ...common,
    "",
    "Platform-specific:",
    ...specific[platform],
  ].join("\n");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "YOUTUBE_SHORTS" | "INSTAGRAM_REELS" | "TIKTOK" | "YOUTUBE_STANDARD";
type CheckStatus = "pass" | "warn" | "fail";

interface ComplianceCheck {
  id: string;
  label: string;
  status: CheckStatus;
}

interface ComplianceReport {
  overallStatus: CheckStatus;
  checks: ComplianceCheck[];
  exportAllowed: boolean;
}

interface ExportRecord {
  id: string;
  platform: string;
  status: string;
  durationSec: number | null;
  fileSizeBytes: number | null;
  aiDisclosureApplied: boolean;
  createdAt: string;
}

interface ExportDetail extends ExportRecord {
  videoDownloadUrl: string | null;
  pdfDownloadUrl: string | null;
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "YOUTUBE_SHORTS", label: "YouTube Shorts" },
  { value: "INSTAGRAM_REELS", label: "Instagram Reels" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE_STANDARD", label: "YouTube" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-600" />;
}

const EXPORT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ASSEMBLING: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

// ─── Compliance summary ───────────────────────────────────────────────────────

function ComplianceSummary({
  report,
  onGoToCompliance,
  projectId,
}: {
  report: ComplianceReport;
  onGoToCompliance: () => void;
  projectId: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        report.overallStatus === "pass"
          ? "border-green-200 bg-green-50"
          : report.overallStatus === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          className={`h-5 w-5 shrink-0 mt-0.5 ${
            report.overallStatus === "pass"
              ? "text-green-600"
              : report.overallStatus === "warn"
              ? "text-amber-600"
              : "text-red-600"
          }`}
        />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {report.overallStatus === "pass"
              ? "All compliance checks passed"
              : report.overallStatus === "warn"
              ? "Compliance warnings — export allowed"
              : "Compliance failed — export blocked"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.checks.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-xs">
                <StatusIcon status={c.status} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" asChild>
          <a href={`/projects/${projectId}/compliance`}>Details</a>
        </Button>
      </div>
    </div>
  );
}

// ─── Export history row ───────────────────────────────────────────────────────

function ExportRow({
  exp,
  onDownload,
}: {
  exp: ExportRecord;
  onDownload: (exportId: string) => void;
}) {
  const platformLabel: Record<string, string> = {
    YOUTUBE_SHORTS: "YT Shorts",
    INSTAGRAM_REELS: "IG Reels",
    TIKTOK: "TikTok",
    YOUTUBE_STANDARD: "YouTube",
  };

  return (
    <div className="flex items-center gap-3 rounded-md border px-4 py-3 text-sm">
      <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{platformLabel[exp.platform] ?? exp.platform}</span>
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${EXPORT_STATUS_STYLES[exp.status] ?? EXPORT_STATUS_STYLES.PENDING}`}
          >
            {exp.status === "ASSEMBLING" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {exp.status}
          </span>
          {exp.aiDisclosureApplied && (
            <span className="text-xs text-green-600">AI Disclosure ✓</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {exp.durationSec ? fmtDuration(exp.durationSec) : "—"}
          {exp.fileSizeBytes ? ` · ${fmtBytes(exp.fileSizeBytes)}` : ""}
          {" · "}
          {new Date(exp.createdAt).toLocaleString()}
        </p>
      </div>
      {exp.status === "COMPLETE" && (
        <Button size="sm" variant="outline" onClick={() => onDownload(exp.id)}>
          <Download className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ─── Download modal / inline ──────────────────────────────────────────────────

function DownloadCard({ detail }: { detail: ExportDetail }) {
  const [copied, setCopied] = useState(false);

  const platformKey = detail.platform as Platform;

  function handleCopyChecklist() {
    const text = getPlatformChecklist(platformKey, "your project");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Export ready — {new Date(detail.createdAt).toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {detail.videoDownloadUrl ? (
            <Button asChild>
              <a href={detail.videoDownloadUrl} download>
                <Download className="mr-2 h-4 w-4" />
                Download Video
              </a>
            </Button>
          ) : (
            <Button disabled>
              <Download className="mr-2 h-4 w-4" />
              Video unavailable
            </Button>
          )}

          {detail.pdfDownloadUrl ? (
            <Button variant="outline" asChild>
              <a href={detail.pdfDownloadUrl} download>
                <FileText className="mr-2 h-4 w-4" />
                Provenance Report (PDF)
              </a>
            </Button>
          ) : null}

          <Button variant="outline" onClick={handleCopyChecklist}>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            {copied ? "Copied!" : "Copy Upload Checklist"}
          </Button>
        </div>

        {detail.aiDisclosureApplied && (
          <p className="text-xs text-green-600">
            ✓ AI disclosure overlay embedded at 00:00 for 3 seconds
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ExportPanel({
  projectId,
  projectName,
  totalDurationSec,
  initialPlatform,
  recentExports,
  captionCount,
  selectedThumbnailUrl,
}: {
  projectId: string;
  projectName: string;
  totalDurationSec: number;
  initialPlatform: string;
  recentExports: ExportRecord[];
  captionCount: number;
  selectedThumbnailUrl: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform as Platform);
  const [transition, setTransition] = useState<"cut" | "dissolve" | "fade">("cut");
  const [applyColorGrade, setApplyColorGrade] = useState(true);
  const [burnCaptions, setBurnCaptions] = useState(false);
  const [includeSrt, setIncludeSrt] = useState(true);
  const [includeVtt, setIncludeVtt] = useState(true);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeDownload, setActiveDownload] = useState<ExportDetail | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>(recentExports);

  // Auto-run compliance whenever platform changes
  const fetchCompliance = useCallback(async () => {
    setLoadingCompliance(true);
    setCompliance(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/compliance?platform=${platform}&durationSec=${totalDurationSec}`
      );
      const json = await res.json();
      if (res.ok) setCompliance(json.data);
    } catch { /* non-fatal */ }
    finally { setLoadingCompliance(false); }
  }, [projectId, platform, totalDurationSec]);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setActiveDownload(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, transition, applyColorGrade }),
      });
      const json = await res.json();
      if (!res.ok) {
        setExportError(json.error ?? "Export failed");
      } else {
        const exportId = json.data.id;
        setExports((prev) => [json.data, ...prev]);
        // Fetch download URLs
        const detailRes = await fetch(`/api/projects/${projectId}/export/${exportId}`);
        const detailJson = await detailRes.json();
        if (detailRes.ok) setActiveDownload(detailJson.data);
      }
    } catch {
      setExportError("Network error");
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload(exportId: string) {
    const res = await fetch(`/api/projects/${projectId}/export/${exportId}`);
    const json = await res.json();
    if (res.ok) setActiveDownload(json.data);
  }

  const exportAllowed = compliance?.exportAllowed ?? false;

  return (
    <div className="space-y-6">
      {/* Platform tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
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

          {/* Advanced options */}
          <div className="grid grid-cols-2 gap-4 pt-1 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Scene transition
              </label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={transition}
                onChange={(e) => setTransition(e.target.value as typeof transition)}
              >
                <option value="cut">Hard cut</option>
                <option value="dissolve">Dissolve</option>
                <option value="fade">Fade</option>
              </select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                id="colorGrade"
                checked={applyColorGrade}
                onChange={(e) => setApplyColorGrade(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="colorGrade" className="text-sm cursor-pointer">
                Apply cinematic color grade
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Captions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Captions</span>
            {captionCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                Generated — {captionCount} caption{captionCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not generated
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {captionCount === 0 && (
            <p className="text-xs text-amber-600 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Captions increase reach by up to 40% on all major platforms. Consider adding them before export.{" "}
              <a href={`/projects/${projectId}/captions`} className="underline underline-offset-2">
                Generate captions
              </a>
            </p>
          )}
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={burnCaptions}
                onChange={(e) => setBurnCaptions(e.target.checked)}
                disabled={captionCount === 0}
                className="h-4 w-4"
              />
              Burn captions into video
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeSrt}
                onChange={(e) => setIncludeSrt(e.target.checked)}
                disabled={captionCount === 0}
                className="h-4 w-4"
              />
              Include .srt file in export
              {captionCount > 0 && includeSrt && (
                <a
                  href={`/api/captions/${projectId}/download?format=srt`}
                  className="ml-auto text-xs text-primary underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download .srt
                </a>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeVtt}
                onChange={(e) => setIncludeVtt(e.target.checked)}
                disabled={captionCount === 0}
                className="h-4 w-4"
              />
              Include .vtt file in export
              {captionCount > 0 && includeVtt && (
                <a
                  href={`/api/captions/${projectId}/download?format=vtt`}
                  className="ml-auto text-xs text-primary underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download .vtt
                </a>
              )}
            </label>
          </div>
          {captionCount > 0 && (
            <a
              href={`/projects/${projectId}/captions`}
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
            >
              Edit captions
            </a>
          )}
        </CardContent>
      </Card>

      {/* Thumbnail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Thumbnail</span>
            {selectedThumbnailUrl ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                Selected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not selected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedThumbnailUrl && (
            <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedThumbnailUrl} alt="Selected thumbnail" className="h-full w-full object-cover" />
            </div>
          )}
          <a
            href={`/projects/${projectId}/thumbnails`}
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
          >
            {selectedThumbnailUrl ? "Change thumbnail" : "Go to Thumbnail Editor"}
          </a>
        </CardContent>
      </Card>

      {/* Compliance summary */}
      {loadingCompliance && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running compliance checks…
        </div>
      )}
      {compliance && (
        <ComplianceSummary
          report={compliance}
          onGoToCompliance={() => {}}
          projectId={projectId}
        />
      )}

      {/* Export button */}
      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          onClick={handleExport}
          disabled={exporting || !exportAllowed || loadingCompliance}
          title={!exportAllowed ? "Resolve compliance failures first" : ""}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Film className="mr-2 h-4 w-4" />
          )}
          {exporting ? "Assembling & encoding…" : "Export Video"}
        </Button>
        {!exportAllowed && compliance && (
          <p className="text-center text-xs text-destructive">
            Fix compliance failures before exporting.{" "}
            <a href={`/projects/${projectId}/compliance`} className="underline">
              View report
            </a>
          </p>
        )}
        {exportError && (
          <p className="text-center text-xs text-destructive">{exportError}</p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Assembly may take several minutes. Keep this page open.
        </p>
      </div>

      {/* Active download */}
      {activeDownload && <DownloadCard detail={activeDownload} />}

      {/* Export history */}
      {exports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Export History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exports.map((exp) => (
              <ExportRow key={exp.id} exp={exp} onDownload={handleDownload} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

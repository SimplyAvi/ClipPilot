"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  History,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string;
  scriptSnapshot: string;
  configSnapshot: string;
  createdAt: string;
  createdBy: string;
}

interface Props {
  projectId: string;
  initialVersions: SerializedVersion[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function charDiff(versions: SerializedVersion[], current: SerializedVersion): string {
  const idx = versions.findIndex((v) => v.id === current.id);
  const older = versions[idx + 1];
  if (!older) return "Initial version";
  const delta = current.scriptSnapshot.length - older.scriptSnapshot.length;
  if (delta === 0) return "Config change only";
  if (delta > 0) return `+${delta} chars added`;
  return `${Math.abs(delta)} chars removed`;
}

function parseConfig(configSnapshot: string): { name: string; platform: string | null; status: string } {
  try {
    return JSON.parse(configSnapshot);
  } catch {
    return { name: "Unknown", platform: null, status: "DRAFT" };
  }
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  version,
  onClose,
  onRestore,
  restoring,
}: {
  version: SerializedVersion;
  onClose: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  const config = parseConfig(version.configSnapshot);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl border bg-card shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-lg">
              v{version.versionNumber} — {version.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Saved {relativeTime(version.createdAt)} · Project name: {config.name}
              {config.platform ? ` · ${config.platform}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Script preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {version.scriptSnapshot ? (
            <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">
              {version.scriptSnapshot}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No script content in this snapshot.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={restoring}>
            Cancel
          </Button>
          <Button onClick={onRestore} disabled={restoring}>
            {restoring ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restoring…</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" /> Restore this version</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Restore Confirm Modal ────────────────────────────────────────────────────

function RestoreConfirmModal({
  version,
  onConfirm,
  onCancel,
  restoring,
}: {
  version: SerializedVersion;
  onConfirm: () => void;
  onCancel: () => void;
  restoring: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-lg">Restore version?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will restore{" "}
              <span className="font-semibold text-foreground">
                v{version.versionNumber} — {version.label}
              </span>
              . Your current script will be saved as a new snapshot first, so
              you can always undo this restore.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={restoring}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={restoring}>
            {restoring ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restoring…</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Save Version Form ────────────────────────────────────────────────────────

function SaveVersionForm({
  projectId,
  onSaved,
}: {
  projectId: string;
  onSaved: (version: SerializedVersion) => void;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save version");
        return;
      }
      onSaved({
        ...json.data,
        createdAt:
          typeof json.data.createdAt === "string"
            ? json.data.createdAt
            : new Date(json.data.createdAt).toISOString(),
      });
      setLabel("");
      setExpanded(false);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        Save snapshot
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Snapshot label, e.g. 'Before act 2 rewrite'"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="h-9 text-sm"
      />
      <Button size="sm" onClick={handleSave} disabled={saving || !label.trim()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { setExpanded(false); setLabel(""); }}
        disabled={saving}
      >
        <X className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VersionHistory({ projectId, initialVersions }: Props) {
  const router = useRouter();
  const [versions, setVersions] = useState<SerializedVersion[]>(initialVersions);
  const [previewVersion, setPreviewVersion] = useState<SerializedVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SerializedVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleVersionSaved(version: SerializedVersion) {
    setVersions((prev) => [version, ...prev]);
  }

  async function handleRestore(version: SerializedVersion) {
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/versions/${version.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Restore failed");
        return;
      }
      // Reload versions list (safety snapshot was added server-side)
      const listRes = await fetch(`/api/projects/${projectId}/versions`);
      const listJson = await listRes.json();
      if (listRes.ok) {
        setVersions(
          listJson.data.map((v: SerializedVersion & { createdAt: string | Date }) => ({
            ...v,
            createdAt:
              typeof v.createdAt === "string"
                ? v.createdAt
                : new Date(v.createdAt).toISOString(),
          }))
        );
      }
      setPreviewVersion(null);
      setRestoreTarget(null);
      router.refresh();
    } finally {
      setRestoring(false);
    }
  }

  const isEmpty = versions.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Version History</h2>
          {!isEmpty && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {versions.length}
            </span>
          )}
        </div>
        <SaveVersionForm projectId={projectId} onSaved={handleVersionSaved} />
      </div>

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <History className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No snapshots yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Save a snapshot before making big changes so you can always roll
            back.
          </p>
        </div>
      )}

      {/* ── Timeline ── */}
      {!isEmpty && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />

          <ul className="space-y-1">
            {versions.map((v, idx) => {
              const isExpanded = expandedId === v.id;
              const isSystem = v.createdBy === "system";
              const diff = charDiff(versions, v);

              return (
                <li key={v.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div
                    className={`relative z-10 mt-3 h-5 w-5 shrink-0 rounded-full border-2 border-background ${
                      idx === 0
                        ? "bg-primary"
                        : isSystem
                        ? "bg-muted-foreground/40"
                        : "bg-muted-foreground/70"
                    }`}
                  />

                  {/* Card */}
                  <div
                    className={`flex-1 rounded-lg border bg-card px-4 py-3 mb-2 transition-shadow ${
                      isSystem ? "opacity-75" : ""
                    }`}
                  >
                    <button
                      className="flex w-full items-start justify-between text-left"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            v{v.versionNumber}
                          </span>
                          <span className="font-medium text-sm">{v.label}</span>
                          {isSystem && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              auto
                            </span>
                          )}
                          {idx === 0 && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                              latest
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{relativeTime(v.createdAt)}</span>
                          <span>·</span>
                          <span>{diff}</span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </button>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="mt-3 flex items-center gap-2 border-t pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setPreviewVersion(v)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                        {idx !== 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setRestoreTarget(v)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        )}
                        {idx === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            This is the current version
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Preview modal ── */}
      {previewVersion && (
        <PreviewModal
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
          onRestore={() => {
            setPreviewVersion(null);
            setRestoreTarget(previewVersion);
          }}
          restoring={restoring}
        />
      )}

      {/* ── Restore confirm modal ── */}
      {restoreTarget && (
        <RestoreConfirmModal
          version={restoreTarget}
          onConfirm={() => handleRestore(restoreTarget)}
          onCancel={() => setRestoreTarget(null)}
          restoring={restoring}
        />
      )}
    </div>
  );
}

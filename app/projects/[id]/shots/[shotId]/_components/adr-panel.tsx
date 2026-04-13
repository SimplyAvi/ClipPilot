"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Character {
  id: string;
  name: string;
  elevenLabsVoiceId: string | null;
}

interface DialogueLine {
  id: string;
  lineIndex: number;
  text: string;
  deliveryDirection: string | null;
  status: string;
  audioPath: string | null;
  startTimeSec: number | null;
  durationSec: number | null;
  character: Character | null;
}

interface ADRPanelProps {
  shotId: string;
  initialLines: DialogueLine[];
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  GENERATING: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>
      {status === "GENERATING" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Single Line Row ──────────────────────────────────────────────────────────

function LineRow({
  line,
  onUpdated,
}: {
  line: DialogueLine;
  onUpdated: (updated: DialogueLine) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(line.text);
  const [deliveryDirection, setDeliveryDirection] = useState(line.deliveryDirection ?? "");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = text !== line.text || deliveryDirection !== (line.deliveryDirection ?? "");

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    setSuccess(false);

    const body: Record<string, string | null> = {};
    if (text !== line.text) body.text = text;
    if (deliveryDirection !== (line.deliveryDirection ?? "")) {
      body.deliveryDirection = deliveryDirection || null;
    }

    try {
      const res = await fetch(`/api/dialogue/${line.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Regeneration failed");
      } else {
        setSuccess(true);
        onUpdated({
          ...line,
          text,
          deliveryDirection: deliveryDirection || null,
          status: "COMPLETE",
          audioPath: json.data.r2Key,
          durationSec: json.data.estimatedDurationSec,
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Network error");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header row */}
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {line.lineIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {line.character && (
              <span className="text-xs font-semibold">{line.character.name}</span>
            )}
            <StatusChip status={line.status} />
            {line.durationSec !== null && (
              <span className="text-xs text-muted-foreground">~{line.durationSec.toFixed(1)}s</span>
            )}
            {line.startTimeSec !== null && (
              <span className="text-xs text-muted-foreground">@ {line.startTimeSec.toFixed(1)}s</span>
            )}
          </div>
          <p className="mt-1 text-sm">{line.text}</p>
          {line.deliveryDirection && (
            <p className="mt-0.5 text-xs italic text-muted-foreground">[{line.deliveryDirection}]</p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-muted-foreground hover:text-foreground"
          aria-label="Toggle ADR form"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* ADR expand panel */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Replace this line</p>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Dialogue text</label>
            <textarea
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Delivery direction <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. quietly, with fear"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={deliveryDirection}
              onChange={(e) => setDeliveryDirection(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && (
            <p className="text-xs text-green-600">
              Audio regenerated. Re-run Audio Mix + Lip Sync on this shot to update the final video.
            </p>
          )}

          {!line.character?.elevenLabsVoiceId && (
            <p className="text-xs text-amber-600">
              Character has no voice configured — cannot regenerate.
            </p>
          )}

          <Button
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || !line.character?.elevenLabsVoiceId}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            Regenerate audio
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ADRPanel({ shotId, initialLines }: ADRPanelProps) {
  const [lines, setLines] = useState<DialogueLine[]>(initialLines);

  function handleLineUpdated(updated: DialogueLine) {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No dialogue lines for this shot.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <LineRow key={line.id} line={line} onUpdated={handleLineUpdated} />
      ))}
    </div>
  );
}

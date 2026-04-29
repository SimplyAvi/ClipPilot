"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  genre: string;
  tone: string;
  visualStyle: string;
  audioStyle: string;
  targetPlatform: string;
  targetLength: string;
  isBuiltIn: boolean;
  usageCount: number;
  sourceProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialTemplates: TemplateRecord[];
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  "youtube-shorts": "YouTube Shorts",
  "youtube-standard": "YouTube",
  tiktok: "TikTok",
  "instagram-reels": "Instagram Reels",
};

const LENGTH_LABELS: Record<string, string> = {
  short: "~30s",
  medium: "~60s",
  long: "~90s",
  "ai-recommend": "AI picks",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteModal({
  template,
  onConfirm,
  onCancel,
  deleting,
}: {
  template: TemplateRecord;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-lg">Delete template?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{template.name}</span> will be
              permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Use confirmation toast ───────────────────────────────────────────────────

function UseSuccessToast({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-xl">
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
      <p className="text-sm font-medium">
        Loading <span className="text-primary">{name}</span>… redirecting to new project
      </p>
      <button onClick={onDismiss} className="ml-2 text-muted-foreground hover:text-foreground text-xs">✕</button>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onDelete,
  isUsing,
}: {
  template: TemplateRecord;
  onUse: () => void;
  onDelete?: () => void;
  isUsing: boolean;
}) {
  const platform = PLATFORM_LABELS[template.targetPlatform] ?? template.targetPlatform;
  const length = LENGTH_LABELS[template.targetLength] ?? template.targetLength;

  return (
    <div className="relative flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Built-in chip */}
      {template.isBuiltIn && (
        <div className="absolute right-3 top-3">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            Built-in
          </span>
        </div>
      )}

      {/* Usage count chip for user templates */}
      {!template.isBuiltIn && template.usageCount > 0 && (
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            Used {template.usageCount}×
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className="pr-16 font-semibold leading-snug">{template.name}</h3>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize">
          {capitalize(template.genre)}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize">
          {capitalize(template.tone)}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {platform}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {length}
        </span>
      </div>

      {/* Description */}
      <p className="mt-3 flex-1 line-clamp-2 text-sm text-muted-foreground">
        {template.description}
      </p>

      {/* Style preview chips */}
      <div className="mt-3 flex flex-wrap gap-1">
        {[
          { label: "Visual", value: template.visualStyle },
          { label: "Audio", value: template.audioStyle },
        ].map(({ label, value }) => (
          <span
            key={label}
            className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {label}: {capitalize(value)}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t pt-4">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={onUse}
          disabled={isUsing}
        >
          {isUsing ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
          ) : (
            <><ArrowRight className="h-3.5 w-3.5" /> Use this template</>
          )}
        </Button>
        {!template.isBuiltIn && (
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/templates/${template.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export default function TemplateGrid({ initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successName, setSuccessName] = useState<string | null>(null);

  const builtIn = templates.filter((t) => t.isBuiltIn);
  const userTemplates = templates.filter((t) => !t.isBuiltIn);

  async function handleUse(template: TemplateRecord) {
    setUsingId(template.id);
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
          )
        );
        setSuccessName(template.name);
        router.push(`/projects/new?templateId=${template.id}`);
      }
    } finally {
      setUsingId(null);
    }
  }

  async function handleDelete(template: TemplateRecord) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Built-in templates ── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Built-in Templates
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builtIn.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={() => handleUse(t)}
              isUsing={usingId === t.id}
            />
          ))}
        </div>
      </section>

      {/* ── User templates ── */}
      {userTemplates.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            My Templates
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={() => handleUse(t)}
                onDelete={() => setDeleteTarget(t)}
                isUsing={usingId === t.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          template={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Use success toast */}
      {successName && (
        <UseSuccessToast name={successName} onDismiss={() => setSuccessName(null)} />
      )}
    </div>
  );
}

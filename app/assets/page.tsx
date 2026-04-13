import Link from "next/link";
import { db } from "@/lib/db";
import { getAssetClearanceStatus } from "@/lib/asset-validator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Asset, AssetType } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Music,
  FileVideo,
  ImageIcon,
  Mic,
  Plus,
  Sparkles,
  Volume2,
  XCircle,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_TABS: { value: AssetType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "MUSIC", label: "Music" },
  { value: "VOICE", label: "Voice" },
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
  { value: "FOOTAGE", label: "Footage" },
  { value: "AI_GENERATED", label: "AI Generated" },
  { value: "AUDIO", label: "Audio" },
];

const TYPE_ICON: Record<AssetType, React.ReactNode> = {
  MUSIC: <Music className="h-4 w-4" />,
  VOICE: <Mic className="h-4 w-4" />,
  IMAGE: <ImageIcon className="h-4 w-4" />,
  VIDEO: <FileVideo className="h-4 w-4" />,
  FOOTAGE: <FileVideo className="h-4 w-4" />,
  AI_GENERATED: <Sparkles className="h-4 w-4" />,
  AUDIO: <Volume2 className="h-4 w-4" />,
};

const LICENSE_LABELS: Record<string, string> = {
  CC0: "CC0",
  CC_BY: "CC BY",
  CC_BY_SA: "CC BY-SA",
  CC_BY_NC: "CC BY-NC",
  PIXABAY: "Pixabay",
  ROYALTY_FREE: "Royalty-Free",
  ELEVENLABS_COMMERCIAL: "ElevenLabs Commercial",
  RUNWAY_COMMERCIAL: "Runway Commercial",
  LICENSED: "Licensed",
  GENERATED: "AI Generated",
  UNKNOWN: "Unknown",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getAssets(type: AssetType | "ALL") {
  try {
    return await db.asset.findMany({
      where: type === "ALL" ? {} : { type },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ asset }: { asset: Asset }) {
  const { status, reasons } = getAssetClearanceStatus(asset);

  if (status === "CLEARED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 className="h-3 w-3" />
        Cleared
      </span>
    );
  }
  if (status === "NEEDS_REVIEW") {
    return (
      <span
        title={reasons.join(" • ")}
        className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
      >
        <AlertTriangle className="h-3 w-3" />
        Needs Review
      </span>
    );
  }
  return (
    <span
      title={reasons.join(" • ")}
      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
    >
      <XCircle className="h-3 w-3" />
      Blocked
    </span>
  );
}

// ─── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <div className="flex items-center gap-4 border-b py-3 last:border-0">
      {/* Type icon */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {TYPE_ICON[asset.type]}
      </span>

      {/* Name + source */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{asset.name}</p>
        <p className="truncate text-xs text-muted-foreground">{asset.sourceName}</p>
      </div>

      {/* License */}
      <Badge variant="outline" className="hidden shrink-0 sm:flex">
        {LICENSE_LABELS[asset.licenseType] ?? asset.licenseType}
      </Badge>

      {/* Content ID (music only) */}
      {asset.type === "MUSIC" && (
        <span className="hidden shrink-0 text-xs text-muted-foreground lg:block">
          {!asset.contentIdChecked
            ? "ID: —"
            : asset.contentIdClear
            ? "ID: ✓"
            : "ID: ✗"}
        </span>
      )}

      {/* Clearance status */}
      <StatusChip asset={asset} />

      {/* Date */}
      <span className="hidden shrink-0 text-xs text-muted-foreground xl:block">
        {new Date(asset.createdAt).toLocaleDateString()}
      </span>

      {/* Source link */}
      {asset.sourceUrl && (
        <a
          href={asset.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const rawType = searchParams.type?.toUpperCase() as AssetType | "ALL" | undefined;
  const activeType: AssetType | "ALL" =
    rawType && (TYPE_TABS.map((t) => t.value) as string[]).includes(rawType)
      ? rawType
      : "ALL";

  const assets = await getAssets(activeType);

  // Stats for header
  const allAssets = activeType === "ALL" ? assets : await db.asset.findMany().catch(() => []);
  const cleared = allAssets.filter((a) => getAssetClearanceStatus(a).status === "CLEARED").length;
  const needsReview = allAssets.filter((a) => getAssetClearanceStatus(a).status === "NEEDS_REVIEW").length;
  const blocked = allAssets.filter((a) => getAssetClearanceStatus(a).status === "BLOCKED").length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Library</h1>
          <p className="mt-1 text-muted-foreground">
            All licensed assets used in video generation
          </p>
        </div>
        <Button asChild>
          <Link href="/assets/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Link>
        </Button>
      </div>

      {/* Clearance summary */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          {cleared} cleared
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          {needsReview} need review
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
          <XCircle className="h-4 w-4" />
          {blocked} blocked
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "ALL" ? "/assets" : `/assets?type=${tab.value.toLowerCase()}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeType === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Separator className="mb-4" />

      {/* Asset list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {assets.length} asset{assets.length !== 1 ? "s" : ""}
            {activeType !== "ALL" ? ` — ${activeType}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No assets found.{" "}
                <Link href="/assets/new" className="underline underline-offset-2">
                  Add your first asset.
                </Link>
              </p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="mb-1 flex items-center gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="w-8 shrink-0" />
                <span className="flex-1">Name / Source</span>
                <span className="hidden w-28 shrink-0 sm:block">License</span>
                <span className="hidden w-14 shrink-0 lg:block">Content ID</span>
                <span className="w-24 shrink-0">Status</span>
                <span className="hidden w-20 shrink-0 xl:block">Added</span>
                <span className="w-4 shrink-0" />
              </div>
              {assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

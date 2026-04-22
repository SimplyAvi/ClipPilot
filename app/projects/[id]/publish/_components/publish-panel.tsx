"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  ClipboardCopy,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type PlatformTab = "youtube" | "tiktok" | "instagram";

interface ExportInfo {
  id: string;
  platform: string;
  durationSec: number | null;
  createdAt: string;
}

interface PastPost {
  id: string;
  platform: string;
  postUrl: string;
  title: string;
  publishedAt: string;
  status: string;
}

interface ConnectedAccount {
  username: string;
  tokenExpiresAt: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  initialPlatform: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultTags: string[];
  defaultCaption: string;
  defaultHashtags: string[];
  selectedThumbnailUrl: string | null;
  latestExport: ExportInfo | null;
  connectedPlatforms: Record<string, ConnectedAccount>;
  pastPosts: PastPost[];
}

// ─── YouTube categories ────────────────────────────────────────────────────

const YT_CATEGORIES = [
  { id: "22", label: "People & Blogs" },
  { id: "24", label: "Entertainment" },
  { id: "27", label: "Education" },
  { id: "1", label: "Film & Animation" },
  { id: "10", label: "Music" },
  { id: "20", label: "Gaming" },
  { id: "26", label: "Howto & Style" },
  { id: "28", label: "Science & Technology" },
];

// ─── Chips input ────────────────────────────────────────────────────────────

function ChipsInput({
  value,
  onChange,
  placeholder,
  prefix,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  prefix?: string;
}) {
  const [input, setInput] = useState("");

  function addChip(raw: string) {
    const tag = raw.trim().replace(/^#/, "");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && input === "") {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border bg-background px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs font-medium"
        >
          {prefix}{tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="ml-0.5 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={value.length === 0 ? placeholder : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addChip(input)}
      />
    </div>
  );
}

// ─── Not-connected banner ───────────────────────────────────────────────────

function NotConnectedBanner({ platform }: { platform: string }) {
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">
          Connect your {label} account first
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Go to{" "}
          <a href="/settings?tab=connected-accounts" className="underline underline-offset-2">
            Settings → Connected Accounts
          </a>{" "}
          to authorize ClipPilot to publish on your behalf.
        </p>
      </div>
    </div>
  );
}

// ─── Compliance reminder ────────────────────────────────────────────────────

function ComplianceReminder() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        This video will be uploaded with an AI-generated content disclosure. This is
        required by platform policy and cannot be removed.
      </p>
    </div>
  );
}

// ─── Upload result card ─────────────────────────────────────────────────────

function UploadSuccessCard({
  postUrl,
  platformLabel,
}: {
  postUrl: string;
  platformLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="border-green-400 bg-green-50/50">
      <CardContent className="pt-4 pb-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Published to {platformLabel}!
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <a href={postUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View on {platformLabel}
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Past posts list ────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

function PastPostsCard({ posts }: { posts: PastPost[] }) {
  if (posts.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Published Posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm"
          >
            <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">
                {new Date(p.publishedAt).toLocaleDateString()}
              </span>
            </div>
            <a
              href={p.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export default function PublishPanel({
  projectId,
  projectName,
  initialPlatform,
  defaultTitle,
  defaultDescription,
  defaultTags,
  defaultCaption,
  defaultHashtags,
  selectedThumbnailUrl,
  latestExport,
  connectedPlatforms,
  pastPosts,
}: Props) {
  const [platform, setPlatform] = useState<PlatformTab>(initialPlatform as PlatformTab);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    postUrl: string;
    platformLabel: string;
  } | null>(null);
  const [posts, setPosts] = useState<PastPost[]>(pastPosts);

  // ── YouTube state ────────────────────────────────────────────────────────
  const [ytTitle, setYtTitle] = useState(defaultTitle);
  const [ytDescription, setYtDescription] = useState(defaultDescription);
  const [ytTags, setYtTags] = useState<string[]>(defaultTags);
  const [ytCategory, setYtCategory] = useState("22");
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "private" | "unlisted">("unlisted");
  const [ytMadeForKids, setYtMadeForKids] = useState(false);

  // ── TikTok state ─────────────────────────────────────────────────────────
  const [ttCaption, setTtCaption] = useState(defaultCaption);
  const [ttHashtags, setTtHashtags] = useState<string[]>(defaultHashtags);
  const [ttPrivacy, setTtPrivacy] = useState<"PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY">("SELF_ONLY");
  const [ttDuet, setTtDuet] = useState(false);
  const [ttStitch, setTtStitch] = useState(false);
  const [ttComment, setTtComment] = useState(true);

  // ── Instagram state ───────────────────────────────────────────────────────
  const [igCaption, setIgCaption] = useState(defaultCaption);
  const [igShareToFeed, setIgShareToFeed] = useState(true);

  const isConnected = (p: string) => !!connectedPlatforms[p];

  async function handleUpload() {
    if (!latestExport) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const sharedBody = {
      projectId,
      exportId: latestExport.id,
      platform,
    };

    const platformBody =
      platform === "youtube"
        ? {
            title: ytTitle,
            description: ytDescription,
            tags: ytTags,
            categoryId: ytCategory,
            privacyStatus: ytPrivacy,
            madeForKids: ytMadeForKids,
          }
        : platform === "tiktok"
        ? {
            caption: ttCaption,
            hashtags: ttHashtags,
            privacyLevel: ttPrivacy,
            disableDuet: !ttDuet,
            disableStitch: !ttStitch,
            disableComment: !ttComment,
          }
        : {
            caption: igCaption,
            shareToFeed: igShareToFeed,
          };

    try {
      const res = await fetch("/api/social/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sharedBody, ...platformBody }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed");
      } else {
        const { postUrl, platformLabel } = json.data;
        setUploadResult({ postUrl, platformLabel });
        // Refresh posts list
        const postsRes = await fetch(`/api/social/posts/${projectId}`);
        if (postsRes.ok) {
          const postsJson = await postsRes.json();
          setPosts(postsJson.data ?? []);
        }
      }
    } catch {
      setUploadError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  const platformTabs: { id: PlatformTab; label: string }[] = [
    { id: "youtube", label: "YouTube" },
    { id: "tiktok", label: "TikTok" },
    { id: "instagram", label: "Instagram Reels" },
  ];

  const canUpload = isConnected(platform) && !!latestExport && !uploading;

  return (
    <div className="space-y-6">
      {/* No export warning */}
      {!latestExport && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No completed export found</p>
            <p className="text-xs text-amber-700 mt-0.5">
              <a href={`/projects/${projectId}/export`} className="underline">
                Export your video first
              </a>{" "}
              before publishing.
            </p>
          </div>
        </div>
      )}

      {/* Platform tabs */}
      <div className="flex gap-2 border-b pb-px">
        {platformTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setPlatform(t.id); setUploadError(null); setUploadResult(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              platform === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Not connected banner */}
      {!isConnected(platform) && <NotConnectedBanner platform={platform} />}

      {/* ── YouTube tab ────────────────────────────────────────────────────── */}
      {platform === "youtube" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="yt-title">Title</Label>
              <span className="text-xs text-muted-foreground">{ytTitle.length}/100</span>
            </div>
            <Input
              id="yt-title"
              value={ytTitle}
              maxLength={100}
              onChange={(e) => setYtTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="yt-desc">Description</Label>
              <span className="text-xs text-muted-foreground">{ytDescription.length}/5000</span>
            </div>
            <Textarea
              id="yt-desc"
              rows={5}
              value={ytDescription}
              maxLength={5000}
              onChange={(e) => setYtDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <ChipsInput
              value={ytTags}
              onChange={setYtTags}
              placeholder="Type a tag and press Enter"
            />
            <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ytCategory}
                onChange={(e) => setYtCategory(e.target.value)}
              >
                {YT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Privacy</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ytPrivacy}
                onChange={(e) => setYtPrivacy(e.target.value as typeof ytPrivacy)}
              >
                <option value="unlisted">Unlisted (recommended)</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {/* Thumbnail preview */}
          {selectedThumbnailUrl && (
            <div className="space-y-1.5">
              <Label>Thumbnail</Label>
              <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedThumbnailUrl} alt="Thumbnail" className="h-full w-full object-cover" />
              </div>
              <a href={`/projects/${projectId}/thumbnails`} className="text-xs text-primary underline underline-offset-2">
                Change thumbnail
              </a>
            </div>
          )}

          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={ytMadeForKids}
                onChange={(e) => setYtMadeForKids(e.target.checked)}
              />
              <div>
                <span className="text-sm font-medium">Made for kids</span>
                <p className="text-xs text-muted-foreground">
                  Enable if content is primarily intended for children.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={true}
                readOnly
                disabled
              />
              <div>
                <span className="text-sm font-medium">Contains AI-generated content</span>
                <p className="text-xs text-muted-foreground">
                  Required by YouTube policy for AI-generated videos. Cannot be disabled.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── TikTok tab ─────────────────────────────────────────────────────── */}
      {platform === "tiktok" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="tt-caption">Caption</Label>
              <span className="text-xs text-muted-foreground">{ttCaption.length}/2200</span>
            </div>
            <Textarea
              id="tt-caption"
              rows={4}
              value={ttCaption}
              maxLength={2200}
              onChange={(e) => setTtCaption(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtags</Label>
            <ChipsInput
              value={ttHashtags}
              onChange={setTtHashtags}
              placeholder="Add hashtags"
              prefix="#"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Privacy</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={ttPrivacy}
              onChange={(e) => setTtPrivacy(e.target.value as typeof ttPrivacy)}
            >
              <option value="SELF_ONLY">Private (only me — recommended)</option>
              <option value="PUBLIC_TO_EVERYONE">Public</option>
              <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
            </select>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Interactions</p>
            {[
              { label: "Allow Duet", value: ttDuet, set: setTtDuet },
              { label: "Allow Stitch", value: ttStitch, set: setTtStitch },
              { label: "Allow Comments", value: ttComment, set: setTtComment },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={value}
                  onChange={(e) => set(e.target.checked)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Instagram tab ──────────────────────────────────────────────────── */}
      {platform === "instagram" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="ig-caption">Caption</Label>
              <span className="text-xs text-muted-foreground">{igCaption.length}/2200</span>
            </div>
            <Textarea
              id="ig-caption"
              rows={4}
              value={igCaption}
              maxLength={2200}
              onChange={(e) => setIgCaption(e.target.value)}
            />
          </div>

          {selectedThumbnailUrl && (
            <div className="space-y-1.5">
              <Label>Cover Image</Label>
              <div className="overflow-hidden rounded-md border" style={{ maxWidth: 180 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedThumbnailUrl}
                  alt="Cover"
                  className="w-full object-cover aspect-square"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={igShareToFeed}
              onChange={(e) => setIgShareToFeed(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium">Share to Feed</span>
              <p className="text-xs text-muted-foreground">
                Also show this Reel on your profile grid.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Compliance reminder */}
      <ComplianceReminder />

      {/* Upload button + status */}
      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full"
          onClick={handleUpload}
          disabled={!canUpload}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading to {PLATFORM_LABELS[platform]}…
            </>
          ) : (
            `Publish to ${PLATFORM_LABELS[platform]}`
          )}
        </Button>

        {uploading && (
          <div className="w-full rounded-full bg-muted h-2 overflow-hidden">
            <div className="h-full bg-primary animate-pulse w-2/3 rounded-full transition-all" />
          </div>
        )}

        {uploadError && (
          <p className="text-center text-sm text-destructive">{uploadError}</p>
        )}

        {!latestExport && (
          <p className="text-center text-xs text-muted-foreground">
            Export a video first before publishing.
          </p>
        )}
      </div>

      {/* Success result */}
      {uploadResult && (
        <UploadSuccessCard
          postUrl={uploadResult.postUrl}
          platformLabel={uploadResult.platformLabel}
        />
      )}

      {/* Past posts */}
      <PastPostsCard posts={posts} />
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import PublishPanel from "./_components/publish-panel";
import { getSignedViewUrl } from "@/lib/storage";

export const metadata = {
  title: "Publish — ClipPilot",
};

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { platform?: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      exports: {
        where: { status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!project) notFound();

  // Parse script data for pre-filling
  const latestScript = project.scripts[0];
  const parsedData =
    latestScript?.parsedData &&
    typeof latestScript.parsedData === "object" &&
    !Array.isArray(latestScript.parsedData)
      ? (latestScript.parsedData as Record<string, unknown>)
      : {};

  const genre = String(parsedData.genre ?? "");
  const tone = String(parsedData.tone ?? "");
  const logline = String(parsedData.logline ?? "");
  const contentTags: string[] = Array.isArray(parsedData.contentTags)
    ? (parsedData.contentTags as string[])
    : [];

  // Build pre-filled values
  const defaultTitle = project.name.slice(0, 100);
  const aiDisclosure =
    "\n\n---\nThis video was created using AI-generated content (visuals, voice, and music). " +
    "Disclosure required by platform policy.";
  const defaultDescription = logline
    ? `${logline}${aiDisclosure}`.slice(0, 5000)
    : `${project.name}${aiDisclosure}`.slice(0, 5000);
  const defaultTags = [
    ...(genre ? [genre] : []),
    ...(tone ? [tone] : []),
    ...contentTags,
    "AIGenerated",
    "AI",
  ].filter(Boolean).slice(0, 30);
  const defaultCaption = logline
    ? logline.slice(0, 2200)
    : project.name.slice(0, 2200);
  const defaultHashtags = [
    ...(genre ? [genre] : []),
    "AIGenerated",
    "AI",
    "ClipPilot",
  ];

  // Load the most recent complete export
  const latestExport = project.exports[0] ?? null;

  // Get selected thumbnail signed URL
  const selectedThumb = await db.projectThumbnail.findFirst({
    where: { projectId: project.id, isSelected: true, youtubeR2Key: { not: null } },
    select: { youtubeR2Key: true, tiktokR2Key: true, squareR2Key: true },
  });

  let selectedThumbnailUrl: string | null = null;
  if (selectedThumb?.youtubeR2Key) {
    try {
      selectedThumbnailUrl = await getSignedViewUrl(selectedThumb.youtubeR2Key, 7200);
    } catch { /* R2 not configured */ }
  }

  // Check which accounts are connected
  const connectedAccounts = await db.socialAccount.findMany({
    where: { isConnected: true },
    select: { platform: true, username: true, tokenExpiresAt: true },
  });
  const connectedMap = Object.fromEntries(
    connectedAccounts.map((a) => [a.platform, a])
  );

  // Load past posts for this project
  const pastPosts = await db.socialPost.findMany({
    where: { projectId: project.id },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  // Determine initial platform tab from query param
  const validPlatforms = ["youtube", "tiktok", "instagram"];
  const initialPlatform =
    searchParams.platform && validPlatforms.includes(searchParams.platform)
      ? searchParams.platform
      : "youtube";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Publish</h1>
          </div>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <PublishPanel
        projectId={project.id}
        projectName={project.name}
        initialPlatform={initialPlatform}
        defaultTitle={defaultTitle}
        defaultDescription={defaultDescription}
        defaultTags={defaultTags}
        defaultCaption={defaultCaption}
        defaultHashtags={defaultHashtags}
        selectedThumbnailUrl={selectedThumbnailUrl}
        latestExport={
          latestExport
            ? {
                id: latestExport.id,
                platform: latestExport.platform,
                durationSec: latestExport.durationSec,
                createdAt: latestExport.createdAt.toISOString(),
              }
            : null
        }
        connectedPlatforms={Object.fromEntries(
          Object.entries(connectedMap).map(([k, v]) => [
            k,
            { ...v, tokenExpiresAt: v.tokenExpiresAt?.toISOString() ?? null },
          ])
        )}
        pastPosts={pastPosts.map((p) => ({
          id: p.id,
          platform: p.platform,
          postUrl: p.postUrl,
          title: p.title,
          publishedAt: p.publishedAt.toISOString(),
          status: p.status,
        }))}
      />
    </div>
  );
}

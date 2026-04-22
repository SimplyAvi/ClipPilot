/**
 * /projects/[id]/versions
 *
 * Server page: loads the project and all its version snapshots,
 * then renders the <VersionHistory> client component.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import VersionHistory, {
  type SerializedVersion,
} from "./_components/version-history";

export default async function VersionsPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  const rawVersions = await db.projectVersion.findMany({
    where: { projectId: params.id },
    orderBy: { versionNumber: "desc" },
  });

  const versions: SerializedVersion[] = rawVersions.map((v) => ({
    id: v.id,
    projectId: v.projectId,
    versionNumber: v.versionNumber,
    label: v.label,
    scriptSnapshot: v.scriptSnapshot,
    configSnapshot: v.configSnapshot,
    createdAt: v.createdAt.toISOString(),
    createdBy: v.createdBy,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Back navigation ── */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">Version History</p>
        </div>
      </div>

      <VersionHistory projectId={params.id} initialVersions={versions} />
    </div>
  );
}

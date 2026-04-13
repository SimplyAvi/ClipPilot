import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ComplianceChecker from "./_components/compliance-checker";

export default async function CompliancePage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        include: { shots: { select: { duration: true } } },
      },
    },
  });

  if (!project) notFound();

  const totalDurationSec = project.scenes
    .flatMap((s) => s.shots)
    .reduce((sum, sh) => sum + sh.duration, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Compliance Check</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        All checks must pass (or warn at most) before export is allowed. Red checks block export.
        Select the target platform to see platform-specific duration limits.
      </p>

      <ComplianceChecker
        projectId={project.id}
        totalDurationSec={totalDurationSec}
      />
    </div>
  );
}

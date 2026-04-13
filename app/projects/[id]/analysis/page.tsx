import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { ScriptAnalysis } from "@/lib/prompts/script-analysis";
import { AnalysisView } from "./_components/analysis-view";

async function getAnalysis(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!project || project.scripts.length === 0) return null;
  const script = project.scripts[0];
  if (!script.parsedData) return null;

  return {
    project,
    analysis: script.parsedData as unknown as ScriptAnalysis,
    scriptContent: script.content,
  };
}

export default async function AnalysisPage({ params }: { params: { id: string } }) {
  const result = await getAnalysis(params.id);
  if (!result) notFound();

  return (
    <AnalysisView
      projectId={result.project.id}
      projectName={result.project.name}
      analysis={result.analysis}
      scriptContent={result.scriptContent}
    />
  );
}

import { anthropic } from "@/lib/anthropic";
import { db } from "@/lib/db";

export type Beat = {
  beatId: string;
  description: string;
  suggestedShotType?: string;
  emotionalTone?: string;
  sceneNumber?: number;
};

type ParsedScene = {
  sceneNumber?: number;
  title?: string;
  emotionalTone?: string;
  beats?: Array<{
    id?: string;
    beatId?: string;
    description?: string;
    suggestedShotType?: string;
  }>;
};

export async function selectHeroShot(sceneId: string): Promise<Beat> {
  const scene = await db.scene.findUnique({
    where: { id: sceneId },
    include: {
      shots: { orderBy: { shotNumber: "asc" } },
      project: { include: { scripts: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });

  if (!scene) throw new Error("Scene not found");

  const parsed = scene.project.scripts[0]?.parsedData as { scenes?: ParsedScene[] } | null;
  const parsedScene = parsed?.scenes?.find((item) => item.sceneNumber === scene.sceneNumber);
  const beats: Beat[] = parsedScene?.beats?.map((beat, index) => ({
    beatId: beat.beatId ?? beat.id ?? `beat-${index + 1}`,
    description: beat.description ?? `Shot ${index + 1}`,
    suggestedShotType: beat.suggestedShotType,
    emotionalTone: parsedScene.emotionalTone,
    sceneNumber: scene.sceneNumber,
  })) ?? scene.shots.map((shot) => ({
    beatId: shot.id,
    description: shot.prompt ?? `${shot.shotType} shot`,
    suggestedShotType: shot.shotType,
    sceneNumber: scene.sceneNumber,
  }));

  if (beats.length === 0) throw new Error("Analyze your script first to generate scene beats");
  if (beats.length === 1 || !process.env.ANTHROPIC_API_KEY) return beats[Math.floor(beats.length / 2)];

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 80,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Given this list of beats from a scene, identify the single beat most likely to be visually representative of the entire scene's emotional core. Return only the beatId.\n\nScene tone: ${parsedScene?.emotionalTone ?? "unknown"}\nBeats: ${JSON.stringify(beats)}`,
        },
      ],
    });
    const text = message.content.find((block) => block.type === "text")?.text?.trim();
    return beats.find((beat) => beat.beatId === text) ?? beats[Math.floor(beats.length / 2)];
  } catch {
    return beats[Math.floor(beats.length / 2)];
  }
}

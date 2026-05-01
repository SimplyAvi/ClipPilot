import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { generateOutroFrame } from "@/lib/runway/outro-generator";
import { splitDuration } from "@/lib/runway/clip-duration";
import { cleanupDir, ffprobeDuration, materializeStorageFile, pad2 } from "@/lib/runway/utils";
import { getProviderConfig, splitDurationForProvider } from "@/lib/video-providers";

export interface ClipSpec {
  id: string;
  sceneIndex: number;
  clipIndex: number;
  durationSeconds: number;
  startImagePath: string;
  endImagePath: string;
  startTimeOffset: number;
  isLastClipOfScene: boolean;
  isFinalClipOfProject: boolean;
  audioSegmentPath?: string;
  sourceAudioPath?: string;
}

type SceneSource = {
  index: number;
  title: string;
  firstImagePath: string;
  fallbackDurationSeconds: number;
  audioPath?: string;
};

type PlannerProject = {
  id: string;
  name: string;
  scenes: Array<{
    title: string;
    firstImagePath: string | null;
    durationSeconds: number | null;
    shots: Array<{ duration: number }>;
  }>;
  visualSegments: Array<{
    primarySubject: string;
    generatedVideoPath: string | null;
    durationSeconds: number | null;
    narratorAudioPath: string | null;
  }>;
};

export async function planClips(projectId: string, providerId = "runway"): Promise<ClipSpec[]> {
  const provider = getProviderConfig(providerId);
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { include: { shots: true }, orderBy: { sceneNumber: "asc" } },
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) throw new Error("Project not found");

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const sources = await getSceneSources(project, projectSlug);
  if (sources.length === 0) throw new Error("No scene images found. Generate or assign a first image for each scene first.");

  const missing = sources.filter((scene) => !scene.firstImagePath);
  if (missing.length > 0) {
    throw new Error(`Missing first image for: ${missing.map((scene) => `Scene ${scene.index + 1}`).join(", ")}`);
  }

  const outroFramePath = await generateOutroFrame(projectId, project.name);
  const clips: ClipSpec[] = [];

  for (const scene of sources) {
    const measuredDuration = scene.audioPath ? await measureAudioDuration(scene.audioPath) : 0;
    const sceneDuration = Math.max(measuredDuration || scene.fallbackDurationSeconds || 5, 0.1);
    const durations = splitDurationForProvider(sceneDuration, provider);

    for (let clipIndex = 0; clipIndex < durations.length; clipIndex++) {
      const isLastClipOfScene = clipIndex === durations.length - 1;
      const isFinalClipOfProject = scene.index === sources.length - 1 && isLastClipOfScene;
      const previousClipId = `sc${pad2(scene.index + 1)}_clip${clipIndex}`;
      const clipId = `sc${pad2(scene.index + 1)}_clip${clipIndex + 1}`;
      const nextScene = sources[scene.index + 1];

      clips.push({
        id: clipId,
        sceneIndex: scene.index,
        clipIndex,
        durationSeconds: durations[clipIndex],
        startImagePath: clipIndex === 0
          ? scene.firstImagePath
          : `${projectSlug}/video/frames/${previousClipId}_end_frame.jpg`,
        endImagePath: isLastClipOfScene
          ? isFinalClipOfProject
            ? outroFramePath
            : nextScene.firstImagePath
          : `${projectSlug}/video/frames/${clipId}_end_frame.jpg`,
        startTimeOffset: durations.slice(0, clipIndex).reduce((sum, duration) => sum + duration, 0),
        isLastClipOfScene,
        isFinalClipOfProject,
        sourceAudioPath: scene.audioPath,
      });
    }
  }

  return clips;
}

export { splitDuration };

async function getSceneSources(
  project: PlannerProject,
  projectSlug: string
): Promise<SceneSource[]> {
  const sceneSources = project.scenes
    .map((scene, index) => ({
      index,
      title: scene.title,
      firstImagePath: scene.firstImagePath ?? "",
      fallbackDurationSeconds: scene.durationSeconds ?? scene.shots.reduce((sum, shot) => sum + shot.duration, 0) ?? 5,
      audioPath: undefined as string | undefined,
    }))
    .filter((scene) => scene.firstImagePath);

  if (sceneSources.length > 0) {
    return Promise.all(sceneSources.map(async (scene) => ({
      ...scene,
      audioPath: await findSceneAudio(projectSlug, scene.index),
    })));
  }

  return Promise.all(project.visualSegments.map(async (segment, index) => ({
    index,
    title: segment.primarySubject || `Segment ${index + 1}`,
    firstImagePath: segment.generatedVideoPath ?? "",
    fallbackDurationSeconds: segment.durationSeconds ?? 5,
    audioPath: segment.narratorAudioPath ?? await findSceneAudio(projectSlug, index),
  }))).then((sources) => sources.filter((scene) => scene.firstImagePath));
}

async function findSceneAudio(projectSlug: string, sceneIndex: number): Promise<string | undefined> {
  const candidates = [
    `${projectSlug}/audio/sc${pad2(sceneIndex + 1)}_narrator.mp3`,
    `${projectSlug}/audio/narrator_full.mp3`,
    `${projectSlug}/narrator/narrator_seg_${pad2(sceneIndex + 1)}_v1.mp3`,
  ];
  for (const candidate of candidates) {
    if (await storage.exists(candidate)) return candidate;
  }
  return undefined;
}

async function measureAudioDuration(storagePath: string): Promise<number> {
  const file = await materializeStorageFile(storagePath);
  try {
    return await ffprobeDuration(file.localPath);
  } finally {
    cleanupDir(file.tmpDir);
  }
}

import { db } from "@/lib/db";

export interface TimingSegment {
  segmentId: string;
  videoPath: string;
  videoStart: number;
  videoEnd: number;
  audioPath: string;
  audioStart: number;
  timelineStart: number;
  timelineEnd: number;
  loopVideo: boolean;
}

export interface TimingMap {
  segments: TimingSegment[];
  totalDuration: number;
}

export async function syncVisualsToNarrator(projectId: string): Promise<TimingMap> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      narratorProfile: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) throw new Error("Project not found");

  const pause = project.narratorProfile?.pauseSeconds ?? 2;
  let cursor = 0;
  const segments: TimingSegment[] = [];

  for (const segment of project.visualSegments) {
    if (!segment.generatedVideoPath || !segment.narratorAudioPath) continue;
    const audioDuration = segment.durationSeconds ?? 8;
    const timelineEnd = cursor + audioDuration + pause;
    const visualDuration = segment.durationSeconds ?? audioDuration;
    segments.push({
      segmentId: segment.id,
      videoPath: segment.generatedVideoPath,
      videoStart: 0,
      videoEnd: audioDuration + 0.5,
      audioPath: segment.narratorAudioPath,
      audioStart: 0,
      timelineStart: cursor,
      timelineEnd,
      loopVideo: visualDuration < audioDuration,
    });
    cursor = timelineEnd;
  }

  return { segments, totalDuration: cursor };
}

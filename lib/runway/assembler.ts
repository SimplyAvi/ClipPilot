import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { broadcast } from "@/lib/generation/sse-broadcaster";
import { cleanupDir, ffmpegRun, ffprobeDuration, loadFfmpeg, materializeStorageFile, saveLocalFile } from "@/lib/runway/utils";

export async function assembleProject(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { runwayClips: { orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }] } },
  });
  if (!project) throw new Error("Project not found");
  const clips = project.runwayClips.filter((clip) => clip.status === "complete" && clip.muxedVideoPath);
  if (clips.length === 0) throw new Error("No completed Runway clips are ready for assembly.");

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clippilot-runway-assembly-"));

  try {
    const localClips: string[] = [];
    for (const clip of clips) {
      const file = await materializeStorageFile(clip.muxedVideoPath!, ".mp4");
      const stablePath = path.join(tmpDir, `${clip.clipId}_muxed.mp4`);
      fs.copyFileSync(file.localPath, stablePath);
      cleanupDir(file.tmpDir);
      localClips.push(stablePath);
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, localClips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n"));

    const output = path.join(tmpDir, `${projectSlug}_assembled_v1.mp4`);
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg()
      .input(concatPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(output);
    await ffmpegRun(command);

    const duration = await ffprobeDuration(output);
    const finalPath = `${projectSlug}/video/final/${projectSlug}_assembled_v1.mp4`;
    const storedPath = await saveLocalFile(finalPath, output, "video/mp4", { projectId, provider: "ffmpeg" });
    await db.assembledVideo.upsert({
      where: { projectId },
      update: { videoPath: storedPath, durationSec: duration, status: "complete" },
      create: { projectId, videoPath: storedPath, durationSec: duration, status: "complete" },
    });

    const videoUrl = await storage.getUrl(storedPath);
    broadcast(projectId, { type: "assembly_complete", data: { projectId, videoUrl, videoPath: storedPath } });
    return storedPath;
  } finally {
    cleanupDir(tmpDir);
  }
}

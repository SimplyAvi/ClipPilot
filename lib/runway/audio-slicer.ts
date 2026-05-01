import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { cleanupDir, ffmpegRun, loadFfmpeg, materializeStorageFile, pad2, saveLocalFile } from "@/lib/runway/utils";

export async function sliceAudioSegment(
  projectId: string,
  sceneIndex: number,
  clipIndex: number,
  startSec: number,
  durationSec: number,
  sourceAudioPath: string
): Promise<string> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { projectSlug: true, name: true } });
  if (!project) throw new Error("Project not found");

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const input = await materializeStorageFile(sourceAudioPath, path.extname(sourceAudioPath) || ".mp3");
  const tmpDir = input.tmpDir;
  const output = path.join(tmpDir, `sc${pad2(sceneIndex + 1)}_clip${clipIndex + 1}_audio.mp3`);

  try {
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg(input.localPath)
      .inputOptions(["-ss", String(Math.max(0, startSec))])
      .outputOptions(["-t", String(durationSec), "-vn", "-codec:a", "libmp3lame", "-q:a", "4"])
      .output(output);
    await ffmpegRun(command);

    return saveLocalFile(
      `${projectSlug}/audio/clips/sc${pad2(sceneIndex + 1)}_clip${clipIndex + 1}_audio.mp3`,
      output,
      "audio/mpeg",
      { projectId, sceneIndex: String(sceneIndex), clipIndex: String(clipIndex) }
    );
  } finally {
    cleanupDir(tmpDir);
  }
}

export async function muxAudioOntoClip(
  videoPath: string,
  audioPath: string | null,
  outputStoragePath: string,
  metadata?: Record<string, string>
): Promise<string> {
  if (!audioPath) {
    const buffer = await storage.read(videoPath);
    return (await storage.save(outputStoragePath, buffer, "video/mp4", metadata)).path;
  }

  const video = await materializeStorageFile(videoPath, ".mp4");
  const audio = await materializeStorageFile(audioPath, path.extname(audioPath) || ".mp3");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clippilot-runway-mux-"));
  const output = path.join(tmpDir, "muxed.mp4");

  try {
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg()
      .input(video.localPath)
      .input(audio.localPath)
      .outputOptions(["-c:v", "copy", "-c:a", "aac", "-shortest"])
      .output(output);
    await ffmpegRun(command);
    return saveLocalFile(outputStoragePath, output, "video/mp4", metadata);
  } finally {
    cleanupDir(video.tmpDir);
    cleanupDir(audio.tmpDir);
    cleanupDir(tmpDir);
  }
}

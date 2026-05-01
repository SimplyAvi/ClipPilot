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
    include: {
      projectMusicTrack: true,
      runwayClips: { orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }] },
    },
  });
  if (!project) throw new Error("Project not found");
  const clips = project.runwayClips.filter((clip) => clip.muxedVideoPath || clip.videoPath);
  if (clips.length === 0) throw new Error("No saved Runway clips are ready for assembly.");

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clippilot-runway-assembly-"));

  try {
    const localClips: string[] = [];
    for (const clip of clips) {
      const sourcePath = clip.muxedVideoPath ?? clip.videoPath;
      if (!sourcePath) continue;
      const file = await materializeStorageFile(sourcePath, ".mp4");
      const stablePath = path.join(tmpDir, `${clip.clipId}_muxed.mp4`);
      fs.copyFileSync(file.localPath, stablePath);
      cleanupDir(file.tmpDir);
      localClips.push(await ensureAudioStream(stablePath, tmpDir, clip.clipId));
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, localClips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n"));

    const assembledVideo = path.join(tmpDir, `${projectSlug}_assembled_no_music.mp4`);
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg()
      .input(concatPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(assembledVideo);
    await ffmpegRun(command);

    const output = project.projectMusicTrack?.audioPath
      ? await mixBackgroundMusic(assembledVideo, project.projectMusicTrack.audioPath, tmpDir, projectSlug)
      : assembledVideo;

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

async function ensureAudioStream(localVideoPath: string, tmpDir: string, clipId: string): Promise<string> {
  if (await hasAudioStream(localVideoPath)) return localVideoPath;

  const output = path.join(tmpDir, `${clipId}_with_silence.mp4`);
  const duration = await ffprobeDuration(localVideoPath);
  const ffmpeg = loadFfmpeg();
  const command = ffmpeg()
    .input(localVideoPath)
    .input("anullsrc=channel_layout=stereo:sample_rate=44100")
    .inputFormat("lavfi")
    .outputOptions([
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-t", String(duration || 5),
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
    ])
    .output(output);
  await ffmpegRun(command);
  return output;
}

async function mixBackgroundMusic(
  assembledVideoPath: string,
  musicStoragePath: string,
  tmpDir: string,
  projectSlug: string
): Promise<string> {
  if (!await hasAudioStream(assembledVideoPath)) return assembledVideoPath;

  const music = await materializeStorageFile(musicStoragePath, path.extname(musicStoragePath) || ".mp3");
  const output = path.join(tmpDir, `${projectSlug}_assembled_with_music.mp4`);

  try {
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg()
      .input(assembledVideoPath)
      .input(music.localPath)
      .complexFilter([
        "[1:a]volume=0.18,afade=t=in:st=0:d=3,apad[music]",
        "[0:a][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]",
      ])
      .outputOptions([
        "-map", "0:v:0",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-movflags", "+faststart",
      ])
      .output(output);
    await ffmpegRun(command);
    return output;
  } finally {
    cleanupDir(music.tmpDir);
  }
}

function hasAudioStream(localPath: string): Promise<boolean> {
  const ffmpeg = loadFfmpeg();
  return new Promise((resolve) => {
    ffmpeg.ffprobe(localPath, (err: Error | null, metadata: { streams?: Array<{ codec_type?: string }> }) => {
      if (err) return resolve(false);
      resolve(Boolean(metadata.streams?.some((stream) => stream.codec_type === "audio")));
    });
  });
}

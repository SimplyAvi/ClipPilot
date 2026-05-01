import os from "os";
import path from "path";
import { execFile } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { cleanupDir, materializeStorageFile, saveLocalFile } from "@/lib/runway/utils";

export async function extractLastFrame(
  clipVideoPath: string,
  outputImagePath: string
): Promise<string> {
  const input = await materializeStorageFile(clipVideoPath, ".mp4");
  const output = path.join(input.tmpDir, "last_frame.jpg");

  try {
    await extractFrame(input.localPath, output);
    return saveLocalFile(outputImagePath, output, "image/jpeg", { sourceVideoPath: clipVideoPath });
  } finally {
    cleanupDir(input.tmpDir);
  }
}

function extractFrame(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ["-y", "-sseof", "-0.1", "-i", inputPath, "-vframes", "1", "-q:v", "2", outputPath],
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      }
    );
  });
}

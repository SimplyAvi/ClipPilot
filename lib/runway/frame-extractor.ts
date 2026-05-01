import os from "os";
import path from "path";
import { cleanupDir, ffmpegRun, loadFfmpeg, materializeStorageFile, saveLocalFile } from "@/lib/runway/utils";

export async function extractLastFrame(
  clipVideoPath: string,
  outputImagePath: string
): Promise<string> {
  const input = await materializeStorageFile(clipVideoPath, ".mp4");
  const output = path.join(input.tmpDir, "last_frame.jpg");

  try {
    const ffmpeg = loadFfmpeg();
    const command = ffmpeg(input.localPath)
      .inputOptions(["-sseof", "-0.1"])
      .outputOptions(["-vframes", "1", "-q:v", "2"])
      .output(output);
    await ffmpegRun(command);
    return saveLocalFile(outputImagePath, output, "image/jpeg", { sourceVideoPath: clipVideoPath });
  } finally {
    cleanupDir(input.tmpDir);
  }
}

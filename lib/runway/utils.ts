import fs from "fs";
import os from "os";
import path from "path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { storage } from "@/lib/storage";
import { ensureR2ObjectFromLocal } from "@/lib/storage/r2-migration";

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function runwayProjectPath(projectSlug: string, suffix: string): string {
  return `${projectSlug}/${suffix}`.replace(/\/+/g, "/");
}

export async function materializeStorageFile(storagePath: string, suffix = path.extname(storagePath)) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clippilot-runway-"));
  const localPath = path.join(tmpDir, `input${suffix || ".bin"}`);
  fs.writeFileSync(localPath, await storage.read(storagePath));
  return { tmpDir, localPath };
}

export async function saveLocalFile(storagePath: string, localPath: string, mimeType: string, metadata?: Record<string, string>) {
  const stored = await storage.save(storagePath, fs.readFileSync(localPath), mimeType, metadata);
  return stored.path;
}

export function cleanupDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function loadFfmpeg() {
  const mod = require("fluent-ffmpeg");
  const ffmpeg = mod.default ?? mod;
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
  if (ffmpegPath && typeof ffmpeg.setFfmpegPath === "function") ffmpeg.setFfmpegPath(ffmpegPath);
  if (process.env.FFPROBE_PATH && typeof ffmpeg.setFfprobePath === "function") {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }
  return ffmpeg;
}

export function ffmpegRun(command: any): Promise<void> {
  return new Promise((resolve, reject) => {
    command.on("end", () => resolve()).on("error", reject).run();
  });
}

export function ffprobeDuration(localPath: string): Promise<number> {
  const ffmpeg = loadFfmpeg();
  return new Promise((resolve) => {
    ffmpeg.ffprobe(localPath, (err: Error | null, metadata: { format?: { duration?: number } }) => {
      if (err) return resolve(0);
      resolve(Number(metadata.format?.duration ?? 0));
    });
  });
}

export async function getAbsoluteStorageUrl(storagePath: string): Promise<string> {
  await ensureR2ObjectFromLocal(storagePath, { requestedBy: "video-provider" }).catch(() => undefined);
  const url = await storage.getUrl(storagePath);
  if (/^https?:\/\//i.test(url)) return url;
  const base =
    process.env.RUNWAY_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:3001";
  return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

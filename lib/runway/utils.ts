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
  await ensureR2ObjectFromLocal(storagePath, { requestedBy: "runway-materialize" }).catch(() => undefined);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clippilot-runway-"));
  const localPath = path.join(tmpDir, `input${suffix || ".bin"}`);
  const url = await storage.getUrl(storagePath).catch(() => "");
  if (/^https?:\/\//i.test(url)) {
    fs.writeFileSync(localPath, await fetchBuffer(url));
  } else {
    fs.writeFileSync(localPath, await storage.read(storagePath));
  }
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
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    command.on("end", () => finish()).on("error", finish).run();
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

async function fetchBuffer(url: string): Promise<Buffer> {
  const fetchImpl = globalThis.fetch ?? require("node-fetch");
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Could not download storage file (${response.status}) from ${url}`);
  if (typeof response.arrayBuffer === "function") {
    return Buffer.from(await response.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const body = response.body as NodeJS.ReadableStream | null;
    if (!body) return reject(new Error(`Empty response body from ${url}`));
    body.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    body.on("error", reject);
    body.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * lib/themes/ytdlp-check.ts
 *
 * Checks whether yt-dlp is installed and available on PATH.
 * Returns version string if available, or a clear error to
 * show the installation banner in the UI.
 */

import { execSync } from "child_process";

export interface YtdlpStatus {
  available: boolean;
  version?: string;
}

export function checkYtdlp(): YtdlpStatus {
  try {
    const output = execSync("yt-dlp --version", { stdio: "pipe" }).toString().trim();
    return { available: true, version: output };
  } catch {
    return { available: false };
  }
}

export const YTDLP_INSTALL_INSTRUCTIONS = {
  macos: "brew install yt-dlp",
  windows: "winget install yt-dlp",
  manual: "https://github.com/yt-dlp/yt-dlp",
} as const;

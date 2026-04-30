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

// Common install locations — Next.js server doesn't inherit shell PATH
const YTDLP_CANDIDATES = [
  process.env.YTDLP_PATH,          // explicit override via env
  "/usr/local/bin/yt-dlp",         // Homebrew (Intel Mac)
  "/opt/homebrew/bin/yt-dlp",      // Homebrew (Apple Silicon)
  "/usr/bin/yt-dlp",               // Linux system install
  "yt-dlp",                        // fallback: hope it's on PATH
].filter(Boolean) as string[];

export function getYtdlpBin(): string {
  for (const candidate of YTDLP_CANDIDATES) {
    try {
      execSync(`"${candidate}" --version`, { stdio: "pipe" });
      return candidate;
    } catch {
      // try next
    }
  }
  return "yt-dlp"; // last resort
}

export function checkYtdlp(): YtdlpStatus {
  try {
    const bin = getYtdlpBin();
    const output = execSync(`"${bin}" --version`, { stdio: "pipe" }).toString().trim();
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

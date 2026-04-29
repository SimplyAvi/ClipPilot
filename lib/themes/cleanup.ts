/**
 * lib/themes/cleanup.ts
 *
 * Cleans up temporary analysis files older than 1 hour.
 * Called in try/finally of every analysis pipeline run to ensure
 * downloaded videos never accumulate on the user's machine.
 */

import fs from "fs";
import path from "path";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Deletes all files and directories in the given temp dir
 * that were created more than 1 hour ago.
 */
export async function cleanupAnalysisTemp(tempBaseDir: string): Promise<void> {
  if (!fs.existsSync(tempBaseDir)) return;

  const now = Date.now();

  try {
    const entries = fs.readdirSync(tempBaseDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(tempBaseDir, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > ONE_HOUR_MS) {
          if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      } catch {
        // Skip files that can't be stat'd or deleted
      }
    }
  } catch {
    // Non-fatal — cleanup is best-effort
  }
}

/**
 * Immediately deletes a single file (used to delete the downloaded video).
 */
export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Non-fatal
  }
}

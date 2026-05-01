import fs from "fs";
import path from "path";
import type { StorageAdapter, StoredFile } from "./storage-adapter";

const PROJECT_FOLDERS = [
  "01_scripts",
  "02_characters",
  "03_scenes",
  "04_music/cues",
  "04_music/licensed",
  "05_captions",
  "06_thumbnails/variants",
  "07_exports",
  "08_logs",
];

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootPath: string) {}

  async save(
    relativePath: string,
    data: Buffer,
    mimeType: string,
    metadata: Record<string, string> = {}
  ): Promise<StoredFile> {
    const fullPath = this.resolveSafe(relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, data);

    const meta = {
      originalName: path.basename(relativePath),
      mimeType,
      savedAt: new Date().toISOString(),
      metadata,
    };
    fs.writeFileSync(`${fullPath}.meta.json`, JSON.stringify(meta, null, 2));

    return {
      path: normalizePath(relativePath),
      backend: "local",
      url: this.getUrl(relativePath),
      sizeBytes: data.byteLength,
      mimeType,
      metadata,
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.resolveSafe(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}. Check that local storage is still accessible.`);
    }
    return fs.readFileSync(fullPath);
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.resolveSafe(relativePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(this.resolveSafe(relativePath));
  }

  async list(prefix: string): Promise<string[]> {
    const start = this.resolveSafe(prefix || ".");
    if (!fs.existsSync(start)) return [];

    const results: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (!entry.name.endsWith(".meta.json")) {
          results.push(normalizePath(path.relative(this.rootPath, full)));
        }
      }
    };

    const stat = fs.statSync(start);
    if (stat.isDirectory()) walk(start);
    else results.push(normalizePath(prefix));
    return results.sort();
  }

  getUrl(relativePath: string): string {
    return `/api/files/${normalizePath(relativePath).split("/").map(encodeURIComponent).join("/")}`;
  }

  async initProjectFolders(projectSlug: string, projectName = projectSlug): Promise<void> {
    const root = this.resolveSafe(projectSlug);
    for (const folder of PROJECT_FOLDERS) {
      fs.mkdirSync(path.join(root, folder), { recursive: true });
    }
    const manifestPath = path.join(root, "_manifest.json");
    if (!fs.existsSync(manifestPath)) {
      fs.writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            projectSlug,
            projectName,
            createdAt: new Date().toISOString(),
            storageVersion: "1.0",
            backend: "local",
          },
          null,
          2
        )
      );
    }
  }

  async getProjectSize(projectSlug: string): Promise<number> {
    const root = this.resolveSafe(projectSlug);
    if (!fs.existsSync(root)) return 0;
    let total = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else total += fs.statSync(full).size;
      }
    };
    walk(root);
    return total;
  }

  private resolveSafe(relativePath: string): string {
    const root = path.resolve(this.rootPath);
    const fullPath = path.resolve(root, normalizePath(relativePath));
    if (!fullPath.startsWith(root)) {
      throw new Error("Storage path escapes configured local root");
    }
    return fullPath;
  }
}

function normalizePath(input: string): string {
  return input.replaceAll("\\", "/").replace(/^\/+/, "");
}

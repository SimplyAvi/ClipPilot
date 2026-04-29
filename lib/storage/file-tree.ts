import path from "path";
import { storage } from "@/lib/storage";

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  sizeBytes: number;
  children?: FileTreeNode[];
};

export async function getProjectFileTree(projectSlug: string): Promise<FileTreeNode> {
  const files = await storage.list(projectSlug);
  const root: FileTreeNode = {
    name: projectSlug,
    path: projectSlug,
    type: "folder",
    sizeBytes: 0,
    children: [],
  };

  for (const file of files) {
    const parts = file.split("/");
    let current = root;
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      current.children ??= [];
      let child = current.children.find((node) => node.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          sizeBytes: 0,
          children: isFile ? undefined : [],
        };
        current.children.push(child);
      }
      current = child;
    });
  }

  await hydrateSizes(root);
  sortTree(root);
  return root;
}

async function hydrateSizes(node: FileTreeNode): Promise<number> {
  if (node.type === "file") {
    try {
      node.sizeBytes = (await storage.read(node.path)).byteLength;
    } catch {
      node.sizeBytes = 0;
    }
    return node.sizeBytes;
  }

  let total = 0;
  for (const child of node.children ?? []) total += await hydrateSizes(child);
  node.sizeBytes = total;
  return total;
}

function sortTree(node: FileTreeNode) {
  node.children?.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children?.forEach(sortTree);
}

export function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".mp4": "video/mp4",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".json": "application/json",
      ".srt": "text/plain",
      ".vtt": "text/vtt",
    }[ext] ?? "application/octet-stream"
  );
}

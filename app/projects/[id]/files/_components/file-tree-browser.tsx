"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export type BrowserNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  sizeBytes: number;
  url?: string;
  children?: BrowserNode[];
};

export function FileTreeBrowser({
  tree,
  projectSlug,
}: {
  tree: BrowserNode;
  projectSlug: string;
}) {
  const [preview, setPreview] = useState<BrowserNode | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => fetch(`/api/storage/open-folder?project=${encodeURIComponent(projectSlug)}`)} title="Opens the project folder on your computer">
          <FolderOpen className="mr-2 h-4 w-4" />Open in Finder
        </Button>
      </div>
      <div className="rounded-lg border bg-card p-4 font-mono text-sm">
        <TreeNode node={tree} depth={0} onPreview={setPreview} root />
      </div>
      {preview && <PreviewModal node={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  onPreview,
  root = false,
}: {
  node: BrowserNode;
  depth: number;
  onPreview: (node: BrowserNode) => void;
  root?: boolean;
}) {
  const icon = node.type === "folder" ? "📁" : iconForFile(node.name);
  const isPreviewable = node.type === "file" && /\.(png|jpe?g|webp|mp4|mp3|wav|json)$/i.test(node.name);
  return (
    <div>
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: root ? 0 : depth * 18 }}>
        <span>{icon}</span>
        {isPreviewable ? (
          <button className="text-left hover:underline" onClick={() => onPreview(node)}>{node.name}</button>
        ) : (
          <span>{node.name}</span>
        )}
        <span className="ml-auto font-sans text-xs text-muted-foreground">
          {node.type === "folder" ? `${node.children?.length ?? 0} items` : formatBytes(node.sizeBytes)}
        </span>
      </div>
      {node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onPreview={onPreview} />
      ))}
    </div>
  );
}

function PreviewModal({ node, onClose }: { node: BrowserNode; onClose: () => void }) {
  const url = node.url ?? `/api/storage/local?path=${encodeURIComponent(node.path)}`;
  const isImage = /\.(png|jpe?g|webp)$/i.test(node.name);
  const isVideo = /\.mp4$/i.test(node.name);
  const isAudio = /\.(mp3|wav)$/i.test(node.name);
  const isJson = /\.json$/i.test(node.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg border bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{node.name}</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        {isImage && <img src={url} alt={node.name} className="max-h-[70vh] w-full rounded-lg object-contain" />}
        {isVideo && <video src={url} controls className="w-full rounded-lg" />}
        {isAudio && <audio src={url} controls className="w-full" />}
        {isJson && <JsonPreview url={url} />}
      </div>
    </div>
  );
}

function JsonPreview({ url }: { url: string }) {
  const [text, setText] = useState("Loading...");
  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then((json) => setText(JSON.stringify(json, null, 2)))
      .catch(() => setText("Could not load JSON"));
  }, [url]);
  return <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{text}</pre>;
}

function iconForFile(name: string) {
  if (/\.(png|jpe?g|webp)$/i.test(name)) return "🖼";
  if (/\.mp4$/i.test(name)) return "🎞";
  if (/\.(mp3|wav)$/i.test(name)) return "🔊";
  return "📄";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

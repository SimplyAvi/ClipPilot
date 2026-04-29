"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, FolderOpen, HardDrive, Loader2, Save, XCircle } from "lucide-react";
import type { EnvStatus } from "@/lib/env-status";

interface Props {
  envStatus: EnvStatus;
}

type StorageInfo = {
  localRootPath: string;
  backend: "local" | "r2";
  r2Configured: boolean;
  r2BucketName: string | null;
  r2AccountSuffix: string | null;
  projectsNeedingFolders: number;
  usage: Array<{
    projectId: string;
    projectName: string;
    projectSlug: string;
    files: number;
    sizeBytes: number;
    location: "local" | "r2";
  }>;
};

type VerifyResult = {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  freeSpaceGB: number;
  error?: string;
};

export function StorageTab({ envStatus }: Props) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [path, setPath] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canBrowse = typeof window !== "undefined" && "showDirectoryPicker" in window;

  useEffect(() => {
    loadInfo();
  }, []);

  async function loadInfo() {
    setLoading(true);
    const res = await fetch("/api/settings/storage");
    const json = await res.json();
    if (json.data) {
      setInfo(json.data);
      setPath(json.data.localRootPath ?? "");
    }
    setLoading(false);
  }

  async function browse() {
    const picker = (window as unknown as {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    }).showDirectoryPicker;
    if (!picker) return;
    const dir = await picker();
    setPath(path ? `${path.replace(/\/$/, "")}/${dir.name}` : dir.name);
  }

  async function verifyPath() {
    setVerifyResult(null);
    const res = await fetch("/api/settings/storage/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const json = await res.json();
    setVerifyResult(json.data);
  }

  async function savePath() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localRootPath: path }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setInfo((current) => current ? { ...current, projectsNeedingFolders: json.data.projectsNeedingFolders, localRootPath: path } : current);
      setMessage("Local storage path saved");
    } else {
      setMessage(json.error ?? "Failed to save storage path");
    }
  }

  async function initializeFolders() {
    setInitializing(true);
    const res = await fetch("/api/settings/storage/initialize-folders", { method: "POST" });
    const json = await res.json();
    setInitializing(false);
    setMessage(res.ok ? `Created folders for ${json.data.initialized} projects` : json.error ?? "Folder initialization failed");
    await loadInfo();
  }

  if (loading || !info) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading storage settings...</div>;
  }

  const totalFiles = info.usage.reduce((sum, project) => sum + project.files, 0);
  const totalSize = info.usage.reduce((sum, project) => sum + project.sizeBytes, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Storage Backend</CardTitle>
        </CardHeader>
        <CardContent>
          {info.backend === "r2" ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
              <div className="mb-1 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Cloudflare R2 - Active</div>
              <p className="text-sm">All new files are being saved to your R2 bucket.</p>
              <p className="mt-2 text-xs">Bucket: {info.r2BucketName ?? "Unknown"} · Account ending {info.r2AccountSuffix ?? "----"}</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="mb-1 flex items-center gap-2 font-semibold"><HardDrive className="h-5 w-5" />Local Storage - Active</div>
              <p className="text-sm text-muted-foreground">All files are being saved to your local machine.</p>
              <p className="mt-2 break-all text-xs">Root: {info.localRootPath || "Not set"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local Storage Folder</CardTitle>
          <CardDescription>This is where all project folders and generated files are saved on your machine when not using R2.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="local-root" className="mb-1.5 block">Local Storage Root Folder</Label>
            <Input id="local-root" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/Users/yourname/MyAIVideos" />
          </div>
          <div className="flex flex-col items-end gap-1">
            {canBrowse && (
              <Button variant="outline" onClick={browse}><FolderOpen className="mr-2 h-4 w-4" />Browse</Button>
            )}
            <p className="text-xs text-muted-foreground">Folder browsing works in Chrome and Edge. For Safari or Firefox, type the path manually.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={verifyPath}>Verify Path</Button>
            <Button onClick={savePath} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
            {verifyResult && (
              <span className={`flex items-center gap-1 text-sm ${verifyResult.valid ? "text-green-600" : "text-destructive"}`}>
                {verifyResult.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {verifyResult.valid ? `Path verified - ${verifyResult.freeSpaceGB} GB free` : verifyResult.error}
              </span>
            )}
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
          {info.projectsNeedingFolders > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span>Create folders for {info.projectsNeedingFolders} existing projects?</span>
              <Button size="sm" variant="outline" onClick={initializeFolders} disabled={initializing}>
                {initializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Project Name</th>
                  <th className="px-3 py-2">Files</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Open Folder</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {info.usage.map((project) => (
                  <tr key={project.projectId}>
                    <td className="px-3 py-2 font-medium">{project.projectName}</td>
                    <td className="px-3 py-2">{project.files}</td>
                    <td className="px-3 py-2">{formatBytes(project.sizeBytes)}</td>
                    <td className="px-3 py-2 capitalize">{project.location}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" title="Open folder" onClick={() => fetch(`/api/storage/open-folder?project=${encodeURIComponent(project.projectSlug)}`)}>
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2">{totalFiles}</td>
                  <td className="px-3 py-2">{formatBytes(totalSize)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

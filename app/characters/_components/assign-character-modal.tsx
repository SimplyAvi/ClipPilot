"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { Loader2, X } from "lucide-react";

type ProjectOption = {
  id: string;
  name: string;
  status: string;
  thumbnailPath: string | null;
};

export function AssignCharacterModal({
  open,
  onOpenChange,
  character,
  defaultProjectId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: { id: string; name: string; portraitPath?: string | null };
  defaultProjectId?: string | null;
  onAssigned?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const [roleInProject, setRoleInProject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => setProjects(json.data ?? []))
      .catch(() => setError("Could not load projects"));
  }, [open]);

  useEffect(() => {
    setSelectedProjectId(defaultProjectId ?? "");
  }, [defaultProjectId]);

  if (!open) return null;

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase())
  );

  async function castCharacter() {
    if (!selectedProjectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${character.id}/cast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, roleInProject: roleInProject || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Cast failed");
      onAssigned?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add character to this project. The project may have been deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <PortraitFrame src={character.portraitPath} alt={character.name} size="sm" className="w-12" />
            <div>
              <p className="font-semibold">{character.name}</p>
              <p className="text-sm text-muted-foreground">Select a project to add this character to</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects..." />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  selectedProjectId === project.id ? "border-primary bg-accent" : "hover:bg-accent"
                }`}
              >
                <span className="font-medium">{project.name}</span>
                <Badge variant="secondary">{project.status}</Badge>
              </button>
            ))}
          </div>
          {selectedProjectId && (
            <Input
              value={roleInProject}
              onChange={(e) => setRoleInProject(e.target.value)}
              placeholder="Role in this project, e.g. Lead detective"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={castCharacter} disabled={!selectedProjectId || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cast Character
          </Button>
        </div>
      </div>
    </div>
  );
}

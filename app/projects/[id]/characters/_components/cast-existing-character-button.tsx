"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { Loader2, Plus, X } from "lucide-react";

type CharacterOption = {
  id: string;
  name: string;
  role: string | null;
  portraitPath: string | null;
};

export default function CastExistingCharacterButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [roleInProject, setRoleInProject] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCharacter = characters.find((character) => character.id === selectedId);

  useEffect(() => {
    if (!open) return;
    fetch("/api/characters")
      .then((res) => res.json())
      .then((json) => setCharacters(json.data ?? []))
      .catch(() => setCharacters([]));
  }, [open]);

  async function castCharacter() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await fetch(`/api/characters/${selectedId}/cast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, roleInProject: roleInProject || null }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const filtered = characters.filter((character) =>
    character.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />Cast Existing Character
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold">Cast Existing Character</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-4 p-4">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search character library..." />
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {filtered.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setSelectedId(character.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selectedId === character.id ? "border-primary bg-accent" : "hover:bg-accent"}`}
                  >
                    <PortraitFrame src={character.portraitPath} alt={character.name} size="sm" className="w-12" />
                    <div>
                      <p className="font-medium">{character.name}</p>
                      <p className="text-sm text-muted-foreground">{character.role ?? "Character"}</p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedCharacter && (
                <Input value={roleInProject} onChange={(event) => setRoleInProject(event.target.value)} placeholder={`Role in this project for ${selectedCharacter.name}`} />
              )}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={castCharacter} disabled={!selectedId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cast Character</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssignCharacterModal } from "./assign-character-modal";
import { Play, Plus } from "lucide-react";

export function CharacterDetailActions({
  character,
}: {
  character: { id: string; name: string; portraitPath: string | null; voiceId: string | null };
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);

  async function previewVoice() {
    const res = await fetch(`/api/characters/${character.id}/preview-voice`, { method: "POST" });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    new Audio(url).play();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!character.voiceId} title={!character.voiceId ? "Assign a voice first" : undefined} onClick={previewVoice}>
          <Play className="mr-2 h-4 w-4" />Preview Voice
        </Button>
        <Button onClick={() => setAssignOpen(true)}><Plus className="mr-2 h-4 w-4" />Cast in another project</Button>
      </div>
      <AssignCharacterModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        character={character}
        onAssigned={() => router.refresh()}
      />
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RestorePortraitButton({
  characterId,
  imagePath,
  prompt,
}: {
  characterId: string;
  imagePath: string;
  prompt: string;
}) {
  const router = useRouter();

  async function restore() {
    const res = await fetch(`/api/characters/${characterId}/set-portrait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portraitUrl: imagePath, portraitPrompt: prompt }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={restore}>
      Restore this version
    </Button>
  );
}

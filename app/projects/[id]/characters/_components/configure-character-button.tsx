"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ConfigureCharacterButton({
  projectId,
  characterName,
}: {
  projectId: string;
  characterName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfigure() {
    setLoading(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: characterName }),
      });
      const json = await res.json();
      if (json.data?.id) {
        router.push(`/projects/${projectId}/characters/${json.data.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={handleConfigure} disabled={loading}>
      {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
      Configure
    </Button>
  );
}

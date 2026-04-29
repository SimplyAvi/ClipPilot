import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CharacterForm } from "../_components/character-form";

export default function NewCharacterPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/characters"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Character</h1>
          <p className="text-sm text-muted-foreground">Create a reusable character for your global cast library.</p>
        </div>
      </div>
      <CharacterForm defaultProjectId={searchParams.projectId ?? null} />
    </div>
  );
}

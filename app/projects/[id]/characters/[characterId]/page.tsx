import { redirect } from "next/navigation";

export default function LegacyProjectCharacterPage({
  params,
}: {
  params: { characterId: string };
}) {
  redirect(`/characters/${params.characterId}/edit`);
}

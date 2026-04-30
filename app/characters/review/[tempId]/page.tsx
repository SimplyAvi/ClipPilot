import { CharacterReviewClient } from "./_components/character-review-client";

export default function GeneratedCharacterReviewPage({ params }: { params: { tempId: string } }) {
  return <CharacterReviewClient tempId={params.tempId} />;
}

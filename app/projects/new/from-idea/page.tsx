import IdeaWizard from "./_components/idea-wizard";

export const metadata = {
  title: "Start from Idea — ClipPilot",
};

export default function FromIdeaPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Start from Idea</h1>
        <p className="mt-1 text-muted-foreground">
          Describe your idea and let AI craft a logline, beat structure, and full script.
        </p>
      </div>
      <IdeaWizard />
    </div>
  );
}

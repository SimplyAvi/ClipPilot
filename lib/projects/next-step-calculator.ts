export type RecentActivity = {
  label: string;
  completedAt: Date;
  icon: string;
};

export type NextStep = {
  stepNumber: number;
  totalSteps: number;
  completionPercent: number;
  category: string;
  title: string;
  description: string;
  whyNow: string;
  actionLabel: string;
  actionUrl: string;
  estimatedTime: string;
  estimatedCost: string;
  isBlocking: boolean;
  recentActivity: RecentActivity[];
};

type ProjectWithRelations = {
  id: string;
  name: string;
  updatedAt: Date;
  themeId: string | null;
  productionMode: string;
  scripts: unknown[];
  scenes: Array<{ id: string; status?: string; previews?: Array<Preview>; shots?: unknown[] }>;
  visualSegments: Array<{ id: string; status: string; previews?: Array<Preview> }>;
  projectCharacters: Array<{ character: { portraitPath: string | null } }>;
  narratorProfile: unknown | null;
  projectMusicTrack: { status: string; audioPath: string | null } | null;
  generationJob: { status: string; overallProgress: number; startedAt: Date | null; completedAt: Date | null; estimatedTotalSeconds: number | null } | null;
  transcription: unknown | null;
  thumbnails: Array<{ isSelected: boolean }>;
  exports: Array<{ status: string; updatedAt: Date }>;
  posts: Array<{ platform: string; publishedAt: Date }>;
};

type Preview = { id: string; createdAt: Date; approvedAt: Date | null; scene?: { sceneNumber: number } | null; visualSegment?: { sortOrder: number } | null };

const TOTAL_STEPS = 12;

export function calculateNextStep(project: ProjectWithRelations, skippedSteps: number[] = []): NextStep {
  const recentActivity = buildRecentActivity(project);
  const previews = collectPreviews(project);
  const approvedPreviews = previews.filter((preview) => preview.approvedAt);
  const isVisualNarrator = project.productionMode === "visual_narrator";
  const generated = project.generationJob;

  const candidates: NextStep[] = [
    step(project, 1, "planning", "Add Your Script or Story", "Your project has no script yet. Upload an existing screenplay, paste text, or use the Script Writer to create one from an idea.", "Everything else depends on having a script first.", "Add a Script", `/projects/${project.id}/analysis`, "2-5 minutes", "Free", true, recentActivity, project.scripts.length === 0),
    step(project, 2, "planning", "Analyze Your Script", "Your script has been added but not yet analyzed. Analysis breaks it into scenes, beats, and shots and recommends the best runtime.", "Script analysis creates the production plan the rest of the pipeline runs on.", "Analyze Script Now", `/projects/${project.id}/analysis`, "Under 1 minute", "~$0.01", true, recentActivity, project.scripts.length > 0 && project.scenes.length === 0 && project.visualSegments.length === 0),
    step(project, 3, "theme", "Choose a Theme (Recommended)", "Your script is analyzed and ready. Selecting a theme now helps every generated shot match a consistent visual style.", "Themes are optional, but when set here they apply to visuals, music, color grading, and characters automatically.", "Browse Themes", "/themes", "1-2 minutes", "Free", false, recentActivity, (project.scenes.length > 0 || project.visualSegments.length > 0) && !project.themeId),
    step(project, 4, "characters", "Add Characters to This Project", "Your script is ready, but no characters are assigned to this project yet.", "Shot generation needs character visual references to maintain consistency across the whole video.", "Add Characters", `/projects/${project.id}/characters`, "5-15 minutes", "~$0.50 per portrait", true, recentActivity, project.productionMode === "character_driven" && project.projectCharacters.length === 0),
    step(project, 5, "characters", "Generate Character Portraits", `${project.projectCharacters.length} character${project.projectCharacters.length === 1 ? "" : "s"} need portraits before generation can start.`, "Portraits lock visual identity so characters look consistent in every shot.", "Generate Portraits", `/projects/${project.id}/characters`, "2-3 minutes", "~$0.50 per character", true, recentActivity, project.projectCharacters.length > 0 && project.projectCharacters.some((item) => !item.character.portraitPath)),
    step(project, 6, "storyboard", "Review Your Visual Storyboard", "The AI has suggested visuals for each section of your script. Review and approve each concept before generation starts.", "Reviewing now is free. Generating the wrong visuals costs money and time.", "Open Storyboard", `/projects/${project.id}/visual-storyboard`, "5-10 minutes", "Free", true, recentActivity, isVisualNarrator && project.visualSegments.length > 0 && project.visualSegments.every((segment) => !["concept_approved", "generated", "needs_review"].includes(segment.status))),
    step(project, 7, "testing", "Test a Scene Before Generating", "You haven't tested any scenes yet. A Quick Test generates one representative visual in about 30 seconds so you can confirm the style before full generation.", "Finding a style mismatch now costs about $0.20. Finding it after full generation costs the full production price.", "Test a Scene", isVisualNarrator ? `/projects/${project.id}/visual-storyboard` : `/projects/${project.id}/analysis`, "30-60 seconds", "~$0.20", false, recentActivity, (project.scenes.length > 0 || project.visualSegments.length > 0) && previews.length === 0),
    step(project, 8, "testing", "Review Your Scene Test Results", `You have ${previews.length} scene test result${previews.length === 1 ? "" : "s"} waiting for review.`, "Approve a test before committing to full production.", "Review Test Results", isVisualNarrator ? `/projects/${project.id}/visual-storyboard` : `/projects/${project.id}/analysis`, "1-2 minutes", "Free", true, recentActivity, previews.length > 0 && approvedPreviews.length === 0),
    step(project, 9, "voice", "Configure the Narrator Voice", "Choose the voice that will read your script over the visuals. Pick tone and pace, then preview it reading a stanza.", "The narrator carries visual-only projects, so voice fit matters before final assembly.", "Configure Narrator", `/projects/${project.id}/narrator`, "3-5 minutes", "~$0.05 preview", true, recentActivity, isVisualNarrator && !project.narratorProfile),
    step(project, 10, "music", "Configure the Music", "Set the music style and generate or choose a score that follows the emotional arc of your video.", "Music should support the narrator before full assembly begins.", "Configure Music", isVisualNarrator ? `/projects/${project.id}/project-music` : `/projects/${project.id}/music`, "2 minutes + generation time", "~$0.50", false, recentActivity, !project.projectMusicTrack || project.projectMusicTrack.status === "pending"),
    step(project, 11, "generating", generated?.status === "running" ? "Generation in Progress" : generated?.status === "paused" ? "Generation is Paused" : "Ready to Generate", generated?.status === "running" ? `Your video is being generated right now. ${Math.round(generated.overallProgress)}% complete.` : generated?.status === "paused" ? `Generation stopped at ${Math.round(generated.overallProgress)}%. Resume when you're ready.` : "Everything is configured. Your project is ready for full generation.", "All scenes will be generated, voices recorded, and the video assembled automatically.", generated?.status === "running" ? "View Production Monitor" : generated?.status === "paused" ? "Resume Generation" : "Start Generation", `/projects/${project.id}/generate`, generated?.status === "running" ? "In progress" : "Varies by length", "Provider costs apply", true, recentActivity, !generated || ["running", "paused"].includes(generated.status)),
    step(project, 12, "captions", "Generate Captions", "Your video is generated. Add captions next to improve reach and meet platform expectations.", "Captions increase accessibility and performance on short-form platforms.", "Generate Captions", `/projects/${project.id}/captions`, "Under 1 minute", "~$0.05", false, recentActivity, generated?.status === "complete" && !project.transcription),
    step(project, 12, "thumbnails", "Create Thumbnails", "Generate thumbnail variants for each platform. Thumbnails are a major driver of click-through rate.", "This is the last creative packaging step before export.", "Create Thumbnails", `/projects/${project.id}/thumbnails`, "1-2 minutes", "~$0.30", false, recentActivity, generated?.status === "complete" && !!project.transcription && project.thumbnails.length === 0),
    step(project, 12, "export", "Export Your Video", "Export your finished video for your target platform. The compliance checker will run automatically before export.", "Export creates the final upload-ready file.", "Export Video", `/projects/${project.id}/export`, "2-3 minutes", "Free", true, recentActivity, generated?.status === "complete" && project.exports.every((item) => item.status !== "COMPLETE")),
    step(project, 12, "publish", "Publish to Social Media", "Your video is exported and ready to post. Connect your account and publish directly from the app.", "Publishing is the final step to get the video live.", "Go to Publish", `/projects/${project.id}/publish`, "2-3 minutes", "Free", false, recentActivity, project.exports.some((item) => item.status === "COMPLETE") && project.posts.length === 0),
  ];

  return candidates.find((candidate) => !skippedSteps.includes(candidate.stepNumber) && candidate.title !== "__skip__") ??
    step(project, 12, "complete", "Video Published", "Your video is live. Analytics data will appear within 24-48 hours.", "The production flow is complete.", "View Analytics", "/analytics", "Ready now", "Free", false, recentActivity, true);
}

export function buildRecentActivity(project: ProjectWithRelations): RecentActivity[] {
  const items: RecentActivity[] = [
    { label: "Project settings updated", completedAt: project.updatedAt, icon: "settings" },
  ];
  for (const preview of collectPreviews(project)) {
    const label = preview.scene?.sceneNumber ? `Scene ${preview.scene.sceneNumber} tested` : `Segment ${(preview.visualSegment?.sortOrder ?? 0) + 1} tested`;
    items.push({ label, completedAt: preview.createdAt, icon: "test" });
    if (preview.approvedAt) items.push({ label: `${label} approved`, completedAt: preview.approvedAt, icon: "check" });
  }
  if (project.generationJob?.startedAt) items.push({ label: "Generation started", completedAt: project.generationJob.startedAt, icon: "play" });
  if (project.generationJob?.completedAt) items.push({ label: "Generation completed", completedAt: project.generationJob.completedAt, icon: "check" });
  if (project.transcription) items.push({ label: "Captions generated", completedAt: project.updatedAt, icon: "captions" });
  for (const exp of project.exports) if (exp.status === "COMPLETE") items.push({ label: "Video exported", completedAt: exp.updatedAt, icon: "export" });
  for (const post of project.posts) items.push({ label: `Published to ${post.platform}`, completedAt: post.publishedAt, icon: "share" });
  return items.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()).slice(0, 3);
}

function collectPreviews(project: ProjectWithRelations): Preview[] {
  return [
    ...project.scenes.flatMap((scene) => scene.previews ?? []),
    ...project.visualSegments.flatMap((segment) => segment.previews ?? []),
  ];
}

function step(project: ProjectWithRelations, stepNumber: number, category: string, title: string, description: string, whyNow: string, actionLabel: string, actionUrl: string, estimatedTime: string, estimatedCost: string, isBlocking: boolean, recentActivity: RecentActivity[], condition: boolean): NextStep {
  if (!condition) return { stepNumber, totalSteps: TOTAL_STEPS, completionPercent: 0, category, title: "__skip__", description: "", whyNow: "", actionLabel: "", actionUrl: "", estimatedTime: "", estimatedCost: "", isBlocking: false, recentActivity };
  return {
    stepNumber,
    totalSteps: TOTAL_STEPS,
    completionPercent: Math.min(100, Math.round((stepNumber / TOTAL_STEPS) * 100)),
    category,
    title,
    description,
    whyNow,
    actionLabel,
    actionUrl,
    estimatedTime,
    estimatedCost,
    isBlocking,
    recentActivity,
  };
}

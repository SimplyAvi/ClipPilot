/**
 * lib/projects/script-diff.ts
 *
 * Analyses script edits to estimate regeneration impact so the UI
 * can show a targeted "what will need to be regenerated?" warning.
 */

export interface ScriptChanges {
  hasChanges: boolean;
  changedScenes: number[];
  newScenes: number[];
  removedScenes: number[];
  dialogueOnlyChanges: boolean;
  structureChanged: boolean;
  estimatedImpact: "minimal" | "moderate" | "full-reanalysis";
}

// ─── Scene extraction ─────────────────────────────────────────────────────────

/**
 * Splits a screenplay into scenes keyed by scene number (1-based).
 * Recognises INT./EXT. sluglines, SCENE N headings, and ACT N headings.
 * Falls back to treating the whole script as scene 1 if no markers found.
 */
function extractScenes(script: string): Map<number, string> {
  const scenes = new Map<number, string>();
  const lines = script.split("\n");
  let sceneIndex = 0;
  let currentText = "";

  const SCENE_HEADER = /^(INT\.|EXT\.|INT\/EXT\.|SCENE\s+\d+|ACT\s+[IVX\d]+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SCENE_HEADER.test(line.trim())) {
      if (sceneIndex > 0) {
        scenes.set(sceneIndex, currentText.trim());
      }
      sceneIndex++;
      currentText = line + "\n";
    } else {
      currentText += line + "\n";
    }
  }

  // Flush last scene
  if (sceneIndex > 0) {
    scenes.set(sceneIndex, currentText.trim());
  } else {
    // No scene markers — treat whole script as a single scene
    scenes.set(1, script.trim());
  }

  return scenes;
}

// ─── Dialogue-only change detection ──────────────────────────────────────────

/**
 * Returns true if the only lines that changed within the scene text are
 * character speech lines (ALL-CAPS names followed by dialogue).
 * A rough heuristic — good enough for the impact-estimation use case.
 */
function isDialogueOnlyChange(oldText: string, newText: string): boolean {
  const stripDialogue = (text: string) =>
    text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        // Remove blank lines and dialogue lines (character name in ALL-CAPS,
        // parenthetical directions, and the speech text that follows)
        return t !== "" && !/^[A-Z][A-Z\s'.-]{1,30}$/.test(t) && !/^\(.*\)$/.test(t);
      })
      .join("\n");

  return stripDialogue(oldText) === stripDialogue(newText);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectChanges(
  oldScript: string,
  newScript: string
): ScriptChanges {
  // Normalize whitespace so cosmetic changes don't trigger false positives
  const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();
  const old = normalize(oldScript);
  const fresh = normalize(newScript);

  if (old === fresh) {
    return {
      hasChanges: false,
      changedScenes: [],
      newScenes: [],
      removedScenes: [],
      dialogueOnlyChanges: false,
      structureChanged: false,
      estimatedImpact: "minimal",
    };
  }

  const oldScenes = extractScenes(old);
  const newScenes = extractScenes(fresh);

  const changedScenes: number[] = [];
  const newSceneNums: number[] = [];
  const removedScenes: number[] = [];

  // Removed
  oldScenes.forEach((_text, num) => {
    if (!newScenes.has(num)) removedScenes.push(num);
  });

  // New + changed
  newScenes.forEach((text, num) => {
    if (!oldScenes.has(num)) {
      newSceneNums.push(num);
    } else if (oldScenes.get(num) !== text) {
      changedScenes.push(num);
    }
  });

  const structureChanged = newSceneNums.length > 0 || removedScenes.length > 0;

  // Check if all modified scenes are dialogue-only edits
  const dialogueOnlyChanges =
    !structureChanged &&
    changedScenes.length > 0 &&
    changedScenes.every((n) =>
      isDialogueOnlyChange(oldScenes.get(n) ?? "", newScenes.get(n) ?? "")
    );

  // Impact estimation
  let estimatedImpact: "minimal" | "moderate" | "full-reanalysis";
  if (structureChanged) {
    estimatedImpact = "full-reanalysis";
  } else if (dialogueOnlyChanges || changedScenes.length <= 2) {
    estimatedImpact = "minimal";
  } else if (changedScenes.length <= 4) {
    estimatedImpact = "moderate";
  } else {
    estimatedImpact = "full-reanalysis";
  }

  return {
    hasChanges: true,
    changedScenes,
    newScenes: newSceneNums,
    removedScenes,
    dialogueOnlyChanges,
    structureChanged,
    estimatedImpact,
  };
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

/** Rough per-scene generation cost in USD for the impact warning modal */
export const COST_PER_SCENE_USD = 6.25;

export function estimateCost(changes: ScriptChanges): number {
  const affectedCount =
    changes.changedScenes.length + changes.newScenes.length;
  if (changes.estimatedImpact === "minimal" && changes.dialogueOnlyChanges) {
    // Dialogue + lip-sync only ≈ $1.25 per scene
    return affectedCount * 1.25;
  }
  return affectedCount * COST_PER_SCENE_USD;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[\s—–-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
}

export function projectPath(projectSlug: string): string {
  return projectSlug;
}

export function scriptPath(projectSlug: string, version = 1): string {
  return `${projectSlug}/01_scripts/script_v${version}.txt`;
}

export function scriptAnalysisPath(projectSlug: string, version = 1): string {
  return `${projectSlug}/01_scripts/analysis_v${version}.json`;
}

export function characterFolderPath(projectSlug: string, characterSlug: string): string {
  return `${projectSlug}/02_characters/char_${slugify(characterSlug)}`;
}

export function characterPortraitPath(
  projectSlug: string,
  characterSlug: string,
  version: number,
  approved = false
): string {
  return `${characterFolderPath(projectSlug, characterSlug)}/portrait_v${version}${approved ? "_approved" : ""}.png`;
}

export function characterBiblePath(projectSlug: string, characterSlug: string): string {
  return `${characterFolderPath(projectSlug, characterSlug)}/character_bible.json`;
}

export function sceneFolderPath(
  projectSlug: string,
  sceneNumber: number,
  locationSlug: string,
  timeOfDay: string
): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}_${slugify(locationSlug)}_${slugify(timeOfDay)}`;
}

export function shotPath(
  projectSlug: string,
  sceneNumber: number,
  beatNumber: number,
  shotNumber: number,
  shotType: string,
  characterSlug: string,
  version: number,
  approved = false
): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}/shots/sc${pad2(sceneNumber)}_b${pad2(beatNumber)}_sh${pad2(shotNumber)}_${slugify(shotType)}_${slugify(characterSlug)}_v${version}${approved ? "_approved" : ""}.mp4`;
}

export function dialoguePath(
  projectSlug: string,
  sceneNumber: number,
  beatNumber: number,
  characterSlug: string,
  lineNumber: number,
  version: number
): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}/dialogue/sc${pad2(sceneNumber)}_b${pad2(beatNumber)}_dlg_${slugify(characterSlug)}_${pad3(lineNumber)}_v${version}.wav`;
}

export function lipSyncPath(
  projectSlug: string,
  sceneNumber: number,
  beatNumber: number,
  shotNumber: number,
  version: number
): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}/lipsync/sc${pad2(sceneNumber)}_b${pad2(beatNumber)}_sh${pad2(shotNumber)}_lipsync_v${version}.mp4`;
}

export function ambiencePath(projectSlug: string, sceneNumber: number, locationSlug: string): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}/ambience/sc${pad2(sceneNumber)}_${slugify(locationSlug)}_ambience.wav`;
}

export function sceneAssemblyPath(
  projectSlug: string,
  sceneNumber: number,
  locationSlug: string,
  version: number
): string {
  return `${projectSlug}/03_scenes/sc${pad2(sceneNumber)}/assembled/sc${pad2(sceneNumber)}_${slugify(locationSlug)}_final_v${version}.mp4`;
}

export function musicCuePath(projectSlug: string, cueName: string, version: number): string {
  return `${projectSlug}/04_music/cues/cue_${slugify(cueName)}_v${version}.wav`;
}

export function licensedTrackPath(projectSlug: string, trackSlug: string): string {
  return `${projectSlug}/04_music/licensed/${slugify(trackSlug)}.wav`;
}

export function licensedTrackLicensePath(projectSlug: string, trackSlug: string): string {
  return `${projectSlug}/04_music/licensed/${slugify(trackSlug)}_license.json`;
}

export function captionPath(projectSlug: string, format: "srt" | "vtt"): string {
  return `${projectSlug}/05_captions/captions.${format}`;
}

export function thumbnailPath(
  projectSlug: string,
  variant: string,
  platform: string,
  selected = false
): string {
  return `${projectSlug}/06_thumbnails/thumbnail_${slugify(variant)}_${slugify(platform)}${selected ? "_selected" : ""}.jpg`;
}

export function exportPath(projectSlug: string, platform: string, version: number): string {
  return `${projectSlug}/07_exports/${projectSlug}_${slugify(platform)}_final_v${version}.mp4`;
}

export function provenanceReportPath(projectSlug: string): string {
  return `${projectSlug}/07_exports/${projectSlug}_provenance_report.pdf`;
}

export function generationLogPath(projectSlug: string): string {
  return `${projectSlug}/08_logs/generation_log.json`;
}

export function costLogPath(projectSlug: string): string {
  return `${projectSlug}/08_logs/cost_log.json`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

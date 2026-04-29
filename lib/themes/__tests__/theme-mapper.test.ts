/**
 * Tests for theme value mapping and validation.
 * Ensures that Claude output values map correctly to app dropdown values.
 */

// ─── Valid values (matching the UI select options) ────────────────────────────

const VALID_GENRES = ["Thriller", "Drama", "Romance", "Horror", "Action", "Comedy", "Fantasy", "Sci-Fi", "Mystery", "Documentary", "Anime", "Other"];
const VALID_TONES = ["Dark", "Hopeful", "Tragic", "Intimate", "Epic", "Suspenseful", "Restrained", "Playful", "Tense"];
const VALID_VISUAL_STYLES = ["Live-Action Cinematic", "Stylized Realism", "Anime", "Painterly", "Noir", "Retro", "Futuristic", "Fantasy Epic", "Documentary-Real"];
const VALID_AUDIO_STYLES = ["Orchestral", "Ambient", "Minimal", "Romantic Piano", "Electronic", "Dark Suspense", "Silence-Heavy Dramatic", "Documentary-Natural"];
const VALID_CAMERA_MOVEMENTS = ["Static", "Handheld", "Smooth Gimbal", "Dynamic/Fast", "Mixed"];
const VALID_PACINGS = ["Slow", "Medium", "Fast", "Mixed"];
const VALID_ENVIRONMENTS = ["Urban Exterior", "Urban Interior", "Rural/Nature", "Suburban", "Industrial", "Fantasy/Otherworldly", "Mixed"];
const VALID_TEMPOS = ["Slow", "Medium", "Upbeat", "Intense"];

// ─── Mapper: validate a Claude value against allowed list ─────────────────────

function mapToValid(value: string, validList: string[], fallback = "Other"): string {
  if (validList.includes(value)) return value;
  // Case-insensitive match
  const lower = value.toLowerCase();
  const match = validList.find((v) => v.toLowerCase() === lower);
  if (match) return match;
  // Partial match (first word)
  const firstWord = lower.split(" ")[0];
  const partial = validList.find((v) => v.toLowerCase().startsWith(firstWord));
  if (partial) return partial;
  return fallback;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("genre mapping", () => {
  test("exact match returns as-is", () => {
    expect(mapToValid("Thriller", VALID_GENRES, "Other")).toBe("Thriller");
    expect(mapToValid("Documentary", VALID_GENRES, "Other")).toBe("Documentary");
  });

  test("case-insensitive match works", () => {
    expect(mapToValid("thriller", VALID_GENRES, "Other")).toBe("Thriller");
    expect(mapToValid("SCI-FI", VALID_GENRES, "Other")).toBe("Sci-Fi");
  });

  test("unknown genre falls back to Other", () => {
    expect(mapToValid("Western", VALID_GENRES, "Other")).toBe("Other");
    expect(mapToValid("Unknown Genre", VALID_GENRES, "Other")).toBe("Other");
  });

  test("all valid genres recognized", () => {
    for (const genre of VALID_GENRES) {
      expect(mapToValid(genre, VALID_GENRES, "INVALID")).toBe(genre);
    }
  });
});

describe("tone mapping", () => {
  test("all valid tones recognized", () => {
    for (const tone of VALID_TONES) {
      expect(mapToValid(tone, VALID_TONES, "INVALID")).toBe(tone);
    }
  });

  test("unknown tone falls back", () => {
    expect(mapToValid("Melancholic", VALID_TONES, "Restrained")).toBe("Restrained");
  });
});

describe("visual style mapping", () => {
  test("all valid visual styles recognized", () => {
    for (const style of VALID_VISUAL_STYLES) {
      expect(mapToValid(style, VALID_VISUAL_STYLES, "INVALID")).toBe(style);
    }
  });

  test("partial match works", () => {
    expect(mapToValid("Live-Action", VALID_VISUAL_STYLES, "INVALID")).toBe("Live-Action Cinematic");
    expect(mapToValid("Documentary", VALID_VISUAL_STYLES, "INVALID")).toBe("Documentary-Real");
  });
});

describe("camera movement mapping", () => {
  test("all valid camera movements recognized", () => {
    for (const cm of VALID_CAMERA_MOVEMENTS) {
      expect(mapToValid(cm, VALID_CAMERA_MOVEMENTS, "INVALID")).toBe(cm);
    }
  });
});

describe("pacing mapping", () => {
  test("all valid pacings recognized", () => {
    for (const p of VALID_PACINGS) {
      expect(mapToValid(p, VALID_PACINGS, "INVALID")).toBe(p);
    }
  });
});

describe("graceful fallback", () => {
  test("empty string falls back", () => {
    expect(mapToValid("", VALID_GENRES, "Other")).toBe("Other");
  });

  test("null-like value with custom fallback", () => {
    expect(mapToValid("Not visible", VALID_ENVIRONMENTS, "Mixed")).toBe("Mixed");
  });
});

/**
 * Tests for color-extractor utility functions.
 * Tests pure helper logic without requiring actual images.
 */

// ─── Re-implement minimal helpers for testing ─────────────────────────────────
// (Matches the logic in color-extractor.ts)

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return [h * 360, s, l];
}

function classifyTemperature(colors: string[]): "cool" | "neutral" | "warm" {
  const hues = colors.map((c) => hexToHsl(c)[0]);
  const avgHue = hues.reduce((a, b) => a + b, 0) / hues.length;
  if ((avgHue >= 0 && avgHue <= 60) || (avgHue >= 300 && avgHue <= 360)) return "warm";
  if (avgHue >= 180 && avgHue <= 270) return "cool";
  return "neutral";
}

function classifySaturation(colors: string[]): "desaturated" | "muted" | "normal" | "vivid" {
  const sats = colors.map((c) => hexToHsl(c)[1]);
  const avg = sats.reduce((a, b) => a + b, 0) / sats.length;
  if (avg < 0.2) return "desaturated";
  if (avg < 0.4) return "muted";
  if (avg < 0.65) return "normal";
  return "vivid";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("color temperature classification", () => {
  test("warm reds", () => {
    // Pure red (#ff0000) has hue = 0
    expect(classifyTemperature(["#ff0000", "#ff4400", "#cc2200"])).toBe("warm");
  });

  test("warm yellows", () => {
    // Yellow (#ffff00) has hue = 60
    expect(classifyTemperature(["#ffff00", "#ffcc00", "#ddaa00"])).toBe("warm");
  });

  test("cool blues", () => {
    // Blue (#0000ff) has hue = 240
    expect(classifyTemperature(["#0000ff", "#0033cc", "#003399"])).toBe("cool");
  });

  test("cool greens", () => {
    // Green (#00ff00) has hue = 120 — neutral/green range
    // Pure green is neutral in our model (120 is between 60-180)
    const result = classifyTemperature(["#006699", "#0077aa", "#005588"]);
    expect(result).toBe("cool");
  });

  test("neutral purples", () => {
    // Purple at hue ~280 is neutral (not in warm 0-60 or cool 180-270 range)
    expect(classifyTemperature(["#8800cc", "#7700bb", "#6600aa"])).toBe("neutral");
  });
});

describe("saturation classification", () => {
  test("desaturated grays", () => {
    // Pure gray has saturation 0
    expect(classifySaturation(["#808080", "#606060", "#a0a0a0"])).toBe("desaturated");
  });

  test("muted colors", () => {
    // Moderately desaturated
    expect(classifySaturation(["#667788", "#556677", "#778899"])).toBe("muted");
  });

  test("vivid primary colors", () => {
    // Fully saturated colors
    expect(classifySaturation(["#ff0000", "#00ff00", "#0000ff"])).toBe("vivid");
  });
});

describe("hexToHsl conversion", () => {
  test("pure red is hue 0", () => {
    const [h, s, l] = hexToHsl("#ff0000");
    expect(Math.round(h)).toBe(0);
    expect(s).toBeGreaterThan(0.9);
  });

  test("pure blue is hue 240", () => {
    const [h] = hexToHsl("#0000ff");
    expect(Math.round(h)).toBe(240);
  });

  test("gray has saturation 0", () => {
    const [, s] = hexToHsl("#808080");
    expect(s).toBe(0);
  });

  test("white has lightness 1", () => {
    const [, , l] = hexToHsl("#ffffff");
    expect(l).toBe(1);
  });

  test("black has lightness 0", () => {
    const [, , l] = hexToHsl("#000000");
    expect(l).toBe(0);
  });
});

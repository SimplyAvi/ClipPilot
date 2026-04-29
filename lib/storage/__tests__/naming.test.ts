import { describe, expect, it } from "vitest";
import { exportPath, shotPath, slugify } from "../naming";

describe("storage naming", () => {
  it("slugifies names", () => {
    expect(slugify("Video Project 1")).toBe("video_project_1");
    expect(slugify("My FIRST Thriller!")).toBe("my_first_thriller");
    expect(slugify("  spaces   everywhere  ")).toBe("spaces_everywhere");
    expect(slugify("special@#$chars")).toBe("specialchars");
    expect(slugify("Marcus's Apartment — Night")).toBe("marcuss_apartment_night");
    expect(slugify("very long name that exceeds forty characters total here")).toHaveLength(40);
  });

  it("builds padded shot paths", () => {
    expect(shotPath("video_project_1", 3, 2, 1, "Close Up", "Marcus", 1)).toContain(
      "sc03_b02_sh01_close_up_marcus_v1.mp4"
    );
    expect(shotPath("video_project_1", 10, 11, 12, "wide", "Ava", 2, true)).toContain(
      "sc10_b11_sh12_wide_ava_v2_approved.mp4"
    );
  });

  it("builds export paths from project slug", () => {
    expect(exportPath("video_project_1", "YouTube Shorts", 1)).toBe(
      "video_project_1/07_exports/video_project_1_youtube_shorts_final_v1.mp4"
    );
  });
});

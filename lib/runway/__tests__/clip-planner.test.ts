import { describe, expect, it } from "vitest";
import { splitDuration } from "../clip-duration";

describe("splitDuration", () => {
  it("splits an 8-second scene into a 5s clip plus a forced 5s continuation", () => {
    expect(splitDuration(8)).toEqual([5, 5]);
  });

  it("uses 10-second clips first and forces short remainders to 5 seconds", () => {
    expect(splitDuration(23)).toEqual([10, 10, 5]);
    expect(splitDuration(12)).toEqual([10, 5]);
  });

  it("emits one 5-second clip for scenes shorter than Runway minimum", () => {
    expect(splitDuration(3)).toEqual([5]);
  });
});

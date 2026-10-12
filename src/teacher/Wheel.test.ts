import { describe, expect, it } from "vitest";
import { landingTurn, randomIndex } from "./Wheel";

/** Slice under the top pointer after turning the wheel clockwise by `turn` degrees. */
const sliceAtPointer = (turn: number, count: number) =>
  Math.floor((((360 - (turn % 360)) % 360) / 360) * count);

describe("landingTurn", () => {
  it("brings the chosen slice under the pointer from any start", () => {
    for (const count of [1, 2, 5, 8, 37])
      for (const from of [0, 1234.5, 3600])
        for (let i = 0; i < count; i++)
          for (const jitter of [-0.5, 0, 0.49])
            expect(
              sliceAtPointer(landingTurn(from, i, count, jitter), count),
            ).toBe(i);
  });

  it("always turns forward by at least five full turns", () => {
    const turn = landingTurn(100, 3, 8, 0);
    expect(turn - 100).toBeGreaterThanOrEqual(5 * 360);
    expect(turn - 100).toBeLessThan(6 * 360);
  });
});

describe("randomIndex", () => {
  it("stays in range", () => {
    for (let i = 0; i < 200; i++) {
      const r = randomIndex(7);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(7);
    }
  });
});

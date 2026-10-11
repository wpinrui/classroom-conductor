import { describe, expect, it } from "vitest";
import { runPulse } from "../src/sandbox.ts";

describe("runPulse", () => {
  it("returns the HTML the code builds from the input", () => {
    expect(runPulse("return '<b>' + input.n + '</b>';", '{"n":3}')).toBe(
      "<b>3</b>",
    );
  });

  it("stops code that runs too long", () => {
    expect(() => runPulse("while (true) {}", "{}", 50)).toThrow(/timed out/);
  });

  it("removes randomness and the clock", () => {
    expect(() => runPulse("return String(Math.random());", "{}")).toThrow();
    expect(() => runPulse("return String(Date.now());", "{}")).toThrow();
  });

  it("keeps the host out of reach", () => {
    const breakout =
      "return String(globalThis.constructor.constructor('return process')());";
    expect(() => runPulse(breakout, "{}")).toThrow();
    expect(() =>
      runPulse(
        "return String(input.constructor.constructor('return process')());",
        "{}",
      ),
    ).toThrow();
    expect(runPulse("return typeof process + typeof require;", "{}")).toBe(
      "undefinedundefined",
    );
  });

  it("rejects output that is not a string", () => {
    expect(() => runPulse("return 1;", "{}")).toThrow(/string/);
  });
});

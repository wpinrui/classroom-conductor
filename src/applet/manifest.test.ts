// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withBridge } from "./bridge";
import { nameKey, parseManifest } from "./manifest";

const page = (manifest: unknown) =>
  `<!doctype html><html><head><script type="application/json" id="conductor-manifest">${JSON.stringify(manifest)}</script></head><body></body></html>`;

const valid = {
  title: "Fractions",
  phases: ["Intro", "Try"],
  instructions: "Be Socratic.",
  pulsePrompt: "Who is stuck?",
};

describe("parseManifest", () => {
  it("reads a valid manifest", () => {
    expect(parseManifest(page(valid))).toEqual(valid);
  });

  it("keeps the optional namelist and prepared states", () => {
    const m = {
      ...valid,
      namelist: ["Ann"],
      preparedStates: [{ name: "Answer", state: { x: 1 }, phase: 1 }],
    };
    expect(parseManifest(page(m))).toEqual(m);
  });

  it("leaves out the chatbot and Pulse when they are absent", () => {
    const m = { title: "Fractions", phases: ["Intro"] };
    expect(parseManifest(page(m))).toEqual(m);
  });

  it.each([
    ["no manifest", "<html></html>"],
    ["bad JSON", page(valid).replace("{", "{,")],
    ["no phases", page({ ...valid, phases: [] })],
    ["a prompt that is not a string", page({ ...valid, pulsePrompt: 3 })],
    [
      "prepared state on an undeclared phase",
      page({ ...valid, preparedStates: [{ name: "a", state: 1, phase: 2 }] }),
    ],
  ])("rejects %s", (_, html) => {
    expect(() => parseManifest(html)).toThrow();
  });
});

describe("nameKey", () => {
  it("matches names regardless of case and spacing", () => {
    expect(nameKey("  Ann   Lee ")).toBe(nameKey("ann lee"));
  });

  it("strips characters database keys forbid", () => {
    expect(nameKey("a.b#c$d[e]f/g")).not.toMatch(/[.#$[\]/]/);
  });
});

describe("withBridge", () => {
  it("runs the bridge before any applet script", () => {
    const html = withBridge(page(valid));
    expect(html.indexOf("window.conductor")).toBeLessThan(
      html.indexOf("conductor-manifest"),
    );
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });
});

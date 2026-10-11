import vm from "node:vm";

export const MAX_OUTPUT = 500_000;

/**
 * Runs Pulse code written by Claude. The code is the body of
 * `function pulse(input)` and must return an HTML string.
 *
 * The context's global has no prototype and the input goes in as a string
 * literal, so no host object is reachable from inside. Randomness and the clock
 * are removed so the same input always gives the same output.
 */
export function runPulse(code: string, input: string, timeoutMs = 2000) {
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: "afterEvaluate",
  });
  // Failures leave the context as plain strings, so no sandbox code runs later.
  const source = `"use strict";
Math.random = () => { throw new Error("Math.random is not allowed"); };
globalThis.Date = undefined;
const pulse = function (input) {
${code}
};
let out;
try {
  out = pulse(JSON.parse(${JSON.stringify(input)}));
} catch (e) {
  let message = "pulse threw";
  try { message = String(e && e.message || e); } catch {}
  throw message;
}
out;`;
  const out: unknown = new vm.Script(source).runInContext(context, {
    timeout: timeoutMs,
  });
  if (typeof out !== "string") throw new Error("pulse must return a string");
  if (out.length > MAX_OUTPUT) throw new Error("pulse output is too large");
  return out;
}

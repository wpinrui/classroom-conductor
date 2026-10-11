import { describe, expect, it } from "vitest";
import { CHAT_WINDOW_MS, chatCooldown, DEFAULT_CHAT_LIMIT } from "./rateLimit";

describe("chatCooldown", () => {
  it("allows sends under the limit", () => {
    expect(chatCooldown([1, 2], 3, 10)).toBeNull();
  });

  it("holds until the oldest counted send leaves the window", () => {
    expect(chatCooldown([100, 200, 300], 3, 400)).toEqual({
      start: 300,
      until: 100 + CHAT_WINDOW_MS,
    });
  });

  it("forgets sends older than the window", () => {
    expect(chatCooldown([0, 1, 2], 3, CHAT_WINDOW_MS + 5)).toBeNull();
  });

  it("treats 0 as unlimited", () => {
    expect(chatCooldown(Array(50).fill(1), 0, 2)).toBeNull();
  });

  it("uses the default when no limit is set", () => {
    const sent = Array.from({ length: DEFAULT_CHAT_LIMIT }, (_, i) => i);
    expect(chatCooldown(sent, undefined, 10)).not.toBeNull();
    expect(chatCooldown(sent.slice(1), undefined, 10)).toBeNull();
  });
});

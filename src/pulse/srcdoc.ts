const BASE_TOKENS = [
  "--color-surface",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-accent",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--font-family",
  "--font-mono",
] as const;

/** Wraps a Pulse's HTML so it starts on the app's surface, type and tokens. */
export function pulseDocument(output: string, root: Element): string {
  const css = getComputedStyle(root);
  const vars = BASE_TOKENS.map(
    (t) => `${t}:${css.getPropertyValue(t).trim()};`,
  ).join("");
  const base = `<meta charset="utf-8"><style>:root{color-scheme:dark;${vars}}body{margin:0;padding:1.5rem;background:var(--color-surface);color:var(--color-text);font-family:var(--font-family);line-height:1.5}</style>`;
  const head = /<head[^>]*>/i.exec(output);
  if (head) {
    const at = head.index + head[0].length;
    return output.slice(0, at) + base + output.slice(at);
  }
  return `<!doctype html>${base}${output}`;
}

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Sends one prompt to Claude and resolves with its reply text. */
export type Claude = (prompt: string) => Promise<string>;

// Fixed and single-line, so it quotes safely through cmd.exe on Windows.
const SYSTEM =
  "You are the Classroom Conductor Engine. Follow the task in the user message exactly and reply with only what it asks for.";

export interface CliOptions {
  /** Executable plus any leading arguments, split on spaces. */
  command: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Runs `claude -p` with every tool and MCP server disabled, so text written by
 * students can never reach the teacher's files. The prompt goes in on stdin.
 */
export function claudeCli({
  command,
  model,
  timeoutMs = 180_000,
}: CliOptions): Claude {
  const [bin, ...lead] = command.trim().split(/\s+/);
  // An empty folder, so no project settings or CLAUDE.md are picked up.
  const cwd = mkdtempSync(join(tmpdir(), "conductor-engine-"));
  const args = [
    ...lead,
    "-p",
    "--system-prompt",
    SYSTEM,
    "--tools",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--output-format",
    "text",
    ...(model ? ["--model", model] : []),
  ];
  const windows = process.platform === "win32";

  return (prompt) =>
    new Promise((resolve, reject) => {
      // cmd.exe is needed to run claude.cmd, and it takes one quoted line.
      const child = windows
        ? spawn([bin, ...args.map((a) => `"${a}"`)].join(" "), {
            cwd,
            shell: true,
            timeout: timeoutMs,
          })
        : spawn(bin, args, { cwd, timeout: timeoutMs });
      let out = "";
      let err = "";
      child.stdout.setEncoding("utf8").on("data", (d: string) => {
        out += d;
      });
      child.stderr.setEncoding("utf8").on("data", (d: string) => {
        err += d;
      });
      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0 && out.trim()) resolve(out.trim());
        else
          reject(
            new Error(
              `claude exited with ${signal ?? code}: ${err.trim() || out.trim()}`,
            ),
          );
      });
      child.stdin.end(prompt);
    });
}

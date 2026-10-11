// Stands in for `claude -p` in tests. Reads the prompt on stdin.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const tools = args.indexOf("--tools");
if (!args.includes("-p") || tools < 0 || args[tools + 1] !== "") {
  console.error("tools must be disabled");
  process.exit(2);
}
const prompt = readFileSync(0, "utf8");
if (prompt.includes("function pulse(input)")) {
  const body = [
    "const done = Object.values(input).filter((s) => s.state.done);",
    "return '<p>' + done.map((s) => s.name).join(' ') + ' done</p>';",
  ];
  console.log(["```js", ...body, "```"].join("\n"));
} else {
  const last = prompt.split("Student: ").at(-1).split("\n")[0];
  console.log(`Echo: ${last}`);
}

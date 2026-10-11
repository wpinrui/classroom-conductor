# Engine

The Engine runs on the teacher's laptop while a lesson is live. It answers student chat and writes Pulses. It talks to Firebase with a service account and to Claude through the `claude` command.

## Setup

You do this once per laptop.

1. Install Node 22.18 or later.
2. Install Claude Code and sign in. Running `claude -p "hi"` in a terminal should print a reply.
3. Run `yarn install` in the repo root. It installs the Engine too.
4. In the Firebase console, open Project settings and then Service accounts. Click Generate new private key. Save the file outside the repo, because it grants full access to the database.
5. Copy `engine/.env.example` to `engine/.env`.
6. In `engine/.env`, set `FIREBASE_DATABASE_URL` to the database URL shown on the Realtime Database page. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full path of the key file.
7. Deploy the database rules with `firebase deploy --only database`. The Engine needs the index on request status that they add.

## Running

Run `yarn engine` in the repo root before the lesson starts. Leave the terminal open. Press Ctrl+C to stop it.

The Engine picks up every session listed under `/live`. A session drops off when the teacher ends it.

## Settings

These go in `engine/.env`.

| Name | Default | Meaning |
| --- | --- | --- |
| `ENGINE_CLAUDE` | `claude` | Command that runs Claude Code. Use a path without spaces. |
| `ENGINE_MODEL` | Claude Code's default | Model passed to `--model`. |
| `ENGINE_CONCURRENCY` | `2` | Requests answered at once across all sessions. |
| `ENGINE_CACHE` | `engine/.cache/pulse-code.json` | Where Pulse code is kept between runs. |

## How it works

Claude runs with every tool and MCP server turned off. It runs in an empty temporary folder. Student text can therefore never reach files on the laptop.

**Chat.** The Engine sends Claude the applet's instructions and the last 40 messages. It appends the reply to the student's chat and marks the request done. It also enforces the chat limit, because students can write requests directly.

**Pulse.** Claude writes the body of `function pulse(input)`, which turns the Pulse's input into HTML. The code runs in a Node `vm` sandbox with a two second limit. Randomness and the clock are removed inside it. Code is cached by applet page and by scope, either whole class or one student. The same state therefore always gives the same Pulse. Claude rewrites the code only when the cached code fails on a new input.

## Tests

`yarn test:engine` runs the tests against the database emulator, which needs Java. A fake `claude` in `test/fake-claude.mjs` stands in for the real one.

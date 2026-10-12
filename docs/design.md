# Visual and interaction design

This is the UI spec for every screen. Tokens live in `src/styles/tokens.css`. Shared styles live in `src/styles/base.css`. The design thread owns both files. Build threads use plain class names and write layout only; colour, type, radius, shadow and motion come from tokens.

## Rules

1. **NEVER add needless text to the frontend, EVER.** If the app is usable without a piece of text, it goes. No titles, headings, helper copy, empty-state sentences, success toasts, "Loading…" or instructions. Use design to communicate intent: position, colour, weight, size, motion and icons.
2. Labels are not needless text. A number, stat or control whose meaning is not obvious at a glance gets a short label. Mode buttons are labelled. A bare count is labelled by its icon.
3. Never output an em-dash or a middle dot, in UI, comments or docs. They stand in for decisions.
4. In meta lines, nav and labels, distinguish items by weight, size, colour or spacing, never by a separator glyph. If two items would get identical treatment, they are one item, so merge or cut.
5. In prose, one idea per sentence.
6. Never use the native `title` attribute. An icon-only control whose meaning is not obvious carries `aria-label` and the same text in `data-tip`, which `base.css` renders as a tooltip after a 400ms hover or on keyboard focus. Obvious icons, such as ✕ to close, get `aria-label` only.
7. Errors are shown on the thing that failed: a red border and a shake on a field, a red ring on a button. A sentence appears only when the cause cannot be shown, such as an applet upload that fails validation.
8. No raw colour outside `tokens.css`. The test in `src/styles/no-raw-color.test.ts` enforces it.

## Principles

- **The applet is the room.** It fills the viewport on every screen. Everything else floats over it and gets out of its way.
- **One accent, one meaning.** Accent marks the thing that is live or selected right now: the active mode, the spotlighted tile, the student being watched. It never decorates.
- **Quiet until needed.** Chrome appears on intent (hover, shortcut, mode change) and fades when not in use.
- **Distance carries meaning.** The teacher reads the join code from across the room and taps modes at arm's length. Big targets, high contrast, minimum hit area 40px.

## Scales

Type, by token:

| Token | Size | Use |
| --- | --- | --- |
| `--font-size-caption` | 14px | names under tiles, timestamps, counts |
| `--font-size-base` | 16px | body, buttons, inputs, chat |
| `--font-size-lg` | 20px | primary actions on the controls panel |
| `--font-size-xl` | 24px | stat values |
| `--font-size-2xl` | 32px | join code input |
| `--font-size-display` | 40px | join code on the controls panel |

Weights: 400 body, 600 for buttons and names, 700 for the join code only. Line height 1.5 for text and 1.1 for display. Codes use `--font-mono` with `letter-spacing: 0.15em`.

Spacing is a 4px grid: `--space-1` (4px) through `--space-12` (48px). Inside a control use 2 or 3. Between controls in a group use 2. Between groups use 6. Floating panels sit `--space-4` from the viewport edge.

Radius: `--radius-sm` for chips and tiles, `--radius-md` for buttons and inputs, `--radius-lg` for floating panels, `--radius-pill` for avatars and the chat launcher.

Surfaces stack bg, surface, surface-raised. A floating panel is `--color-surface` with a 1px `--color-border` and `--shadow-overlay`. A control inside it is `--color-surface-raised`.

Motion: panels slide and fade in over `--duration-base` with `--ease-out`. Hover and press use `--duration-fast`. Reduced motion zeroes both.

Stacking uses the `--z-*` tokens only.

## Controls

| State | Look |
| --- | --- |
| default button | surface-raised fill, border, text |
| primary | accent fill, on-accent text, weight 600 |
| quiet | transparent until hover, then surface-raised |
| pressed or selected (`aria-pressed`, `aria-selected`) | accent-subtle fill, accent border, accent text |
| destructive | quiet, turns danger text and border on hover |
| disabled | 50% opacity |
| focus-visible | 2px accent outline, 2px offset, on every interactive element |

## Join (student)

A centred column, `min(20rem, 90vw)`, on bare `--color-bg`. Code input on top at `--font-size-2xl`, mono, uppercase, centred. Name input below it. Join is primary and full width. Nothing else on the page: no logo, no heading. A rejected field gets a danger border and a shake.

## Library (teacher)

A single column, max 48rem, centred. Upload is the only primary control and sits top left. Dropping files anywhere on the page uploads them, and the page shows a dashed accent outline while a file is dragged over it. Each applet is a row card: name in weight 600, then Start (primary), then a quiet ✕ that turns danger on hover. An empty library shows only the Upload button.

## Teacher session

The teacher's own applet fills the viewport. The controls panel floats on the right, `--width-controls` wide, `--space-4` from the top, right and bottom edges, scrolling inside itself. Ctrl+. or Cmd+. toggles it with a slide.

Panel order, top to bottom, with `--space-6` between groups:

1. **Join code.** Display size, mono, accent. It is the largest thing on the panel.
2. **Presence.** One stat: online over joined, `--font-size-xl`, with a person icon as its label. A success dot when everyone joined is online. Quiet icon buttons follow it on the right: student screens, name wheel and chat.
3. **Mode switcher.** See below.
4. **Mode detail.** Only the controls the active mode needs. Paced shows a phase stepper (−, phase number, +). Reveal shows a source picker: the teacher's current state or each prepared state by name. Group shows the group size stepper and a Shuffle action. Spotlight and Gallery have no detail here. Their picker is the thumbnail grid.
5. **Actions.** Handoff (primary, `--font-size-lg`). Pulse (default). Both full width.
6. **Chat limit.** A stepper labelled with a chat icon. 0 shows as ∞.
7. **End.** Quiet and destructive, pinned to the panel's bottom. It asks for confirmation by turning into a danger-filled "End" on the first click. A second click within 3 seconds ends the session.

### Mode switcher

A 2-column grid of 40px-tall buttons. The ten modes fall into three groups separated by `--space-3` of extra gap. Group membership carries no heading.

| Group | Modes, in order |
| --- | --- |
| Watch | Demo, Reveal, Spotlight, Anonymous, Gallery |
| Work | Independent, Paced, Group |
| Stop | Freeze, Focus |

Labels, exactly: Demo, Reveal, Spotlight, Anonymous, Gallery, Independent, Paced, Group, Freeze, Focus. Anonymous sits directly after Spotlight so the pair reads together. The active mode is the selected state. Focus, when active, uses danger instead of accent, because the whole room is dark.

Keys 1 to 9 and 0 switch modes in table order while the panel is open.

In Spotlight and Anonymous, every student is listed by name under the switcher, sorted by name, like the Reveal choices. Offline students are muted with a dashed border. The spotlighted student is the selected state. Tapping a name spotlights that student, and tapping the selected one again ends the spotlight. Long names wrap.

### Thumbnail grid

A drawer docked to the bottom of the viewport, left of the controls panel, toggled by a grid icon button on the panel. Height 40vh, resizable by dragging its top edge. Tiles auto-fill at a 12rem minimum, 16:10, `--space-3` apart.

A tile is the student's live applet, scaled down and non-interactive, on `--color-surface`. The student's name sits under it in caption size, weight 600. States:

| State | Look |
| --- | --- |
| offline | 40% opacity, name muted |
| spotlighted | 2px accent ring |
| in the gallery | accent ring and a filled check badge top right |
| has a Pulse | small accent dot top left |
| hover | raised border, with Spotlight and Pulse icon buttons in the top right corner |

In Spotlight and Anonymous, clicking a tile spotlights that student. In Gallery, clicking toggles the student in and out of the gallery. In any other mode, clicking a tile opens that student's Pulse if one exists.

### Name wheel

A sheet over the stage, from `--space-4` inside the left edge to `--space-4` left of the controls panel. It stays open when the panel is hidden, so the teacher can project it alone. Surface, border and overlay shadow, like the Pulse sheet. A quiet ✕ sits top right, and Esc also closes it.

- **Pools.** A row of chips at the top, centred: Everyone, then each filter the applet publishes, in its order. Each chip shows its name in weight 600 and its count in caption size, muted. The chosen chip is the selected state. The chips are hidden when the applet publishes no filters. Every pool holds online students only.
- **No repeats.** A toggle chip to the right of the pools, set apart by `--space-6`. Pressed means each drawn student leaves the pool for the rest of the session, and the counts drop to match. Once anyone has been drawn, a quiet reset icon follows it and puts everyone back. The applet can set the toggle too.
- **Wheel.** A disc that fills the rest of the sheet. One slice per student, sorted by name, in three neutral tones (`--color-wheel-0` to `--color-wheel-2`) so no two neighbours match. Names run along the slice's radius in weight 600 and turn round on the left half so none reads upside down. A 1.5 unit `--color-border` rim. An accent pointer at the top.
- **Spin.** A round primary button, 5.5rem, on the hub. It spins at least five full turns over `--duration-spin` with `--ease-spin`, and lands at a random point inside the chosen slice. The same student never comes up twice running while anyone else is in the pool. Chips and Spin are disabled mid-spin.
- **Result.** The winning slice turns accent with on-accent text. The name appears under the wheel at display size, weight 700, accent. It stays until the next spin or until the pool changes.
- An empty pool shows a bare `--color-bg` disc and a disabled Spin.

Reduced motion zeroes `--duration-spin`, so the result shows at once.

### Pulse sheet

A Pulse opens in a sheet over the left of the viewport, leaving the controls panel visible. Width `min(48rem, 100vw - var(--width-controls) - 3rem)`, full height minus `--space-4` margins. The Pulse body is the Engine's freeform output, rendered as-is on `--color-surface`. A whole-class Pulse has no heading. A per-student Pulse shows the student's name at `--font-size-lg`. While a Pulse is pending, its button shows a moving accent bar along its bottom edge. Esc closes the sheet.

## Student stage

The applet fills the viewport in every mode. The student sees no chrome except the chat launcher and the cues below. No mode name is ever shown: the cue is the design.

| Mode | What the student sees |
| --- | --- |
| Demo | The teacher's applet, view-only. A 3px accent inset edge around the viewport means "watching". A Teacher name pill sits bottom left. |
| Reveal | The pushed state, view-only, with the same accent edge and the Teacher name pill. |
| Spotlight | The spotlighted student's applet, view-only, with the accent edge. Their name sits bottom left in a pill: surface fill, border, overlay shadow, `--font-size-xl`, weight 600. |
| Anonymous | As Spotlight, with the pill reading Classmate. |
| Spotlighted student | Their own applet, editable. A 3px success inset edge means "you are on screen", and the pill reads You. |
| Gallery | Selected students' applets in an auto-fit grid, `--space-3` gaps, each view-only with its name in caption size below it. |
| Independent | Their own applet, editable. No cue. |
| Paced | Their own applet, held to the teacher's phase. No cue. |
| Group | Their group's shared applet. Member initials sit top right as overlapping pill avatars. |
| Freeze | Their own applet, view-only, under a 30% scrim. A lock icon sits bottom left in a 48px round surface chip, mirroring the chat launcher. |
| Focus | Solid `--color-scrim` over everything, chat included. Nothing else. |

Group with no group yet: a centred card on `--color-surface`. The student's own group code sits on top at display size, mono. A code input sits below it with a primary Join. No explanatory copy.

View-only applets show the default cursor and swallow input. Mode changes cross-fade over `--duration-base`.

Loading: the viewport stays `--color-bg`. If loading passes 400ms, a single accent dot pulses at the centre. No text.

## Chat

A round launcher button, 48px, bottom right, `--space-4` from the edges, with a speech icon. It sits on the student stage in every mode except Focus. An accent dot on it marks an unread reply.

Opening it slides a drawer in from the right, `--width-chat` wide, full height, over the applet. The drawer has no title. A quiet ✕ sits top right, and Esc also closes it.

- Student messages are right-aligned bubbles: accent-subtle fill, `--radius-lg`, max 85% width.
- Replies are left-aligned plain text on the drawer surface, with no bubble.
- A pending reply shows three dots pulsing in sequence.
- Messages are spaced `--space-3`. A new reply scrolls into view.
- The input is a textarea at the bottom that auto-grows to 6 lines. Enter sends and Shift+Enter breaks a line. The send button is an accent arrow icon.
- When rate-limited, the send button is disabled and a ring around it drains to show the cooldown. No message appears.
- An empty chat shows only the input.

The teacher sees the same drawer for their own use, opened from a chat icon on the controls panel.

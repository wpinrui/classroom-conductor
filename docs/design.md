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
| `--font-size-lg` | 20px | primary actions on the remote |
| `--font-size-xl` | 24px | stat values |
| `--font-size-2xl` | 32px | join code input |
| `--font-size-display` | 40px | join code on the remote |

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

## Two teacher views

The teacher's work splits across two pages, both signed in with the same teacher Google account.

| Page | Route | Device | Job |
| --- | --- | --- | --- |
| Projection | `/teacher` | the laptop that drives the projector | What the class sees on the big screen. No controls. |
| Remote | `/remote` | a phone, a tablet, or a laptop window | Every teacher control, including the library. |

### Pairing

Pairing is automatic. Starting a session writes its id to `teachers/{uid}/current`, and ending it clears that path. Both pages listen to it.

- The projection follows `current`. With no live session it shows bare `--color-bg` and nothing else. When a session starts, it switches to that session's stage. When the session ends, it returns to bare `--color-bg`.
- The remote follows `current` too. With no live session it shows the library. With one, it shows that session's controls.
- `/teacher/session/:session` stays as a deep link to one session's projection.
- Starting a session from the library is the only way in. The library is not reachable while a session is live, so End comes first.
- Any number of remotes can be open at once. They all write the same paths, so they stay in step.

### Stage state

Everything the remote shows on the projector goes through the database, under `sessions/{s}/stage`. Only the teacher reads or writes it.

| Path | Meaning |
| --- | --- |
| `stage/blank` | The projector is blanked. |
| `stage/join` | The join screen fills the projector. |
| `stage/rules` | The class rules fill the projector. |
| `stage/wheel/open` | The name wheel is on the projector. |
| `stage/wheel/pool` | The chosen pool name. |
| `stage/wheel/spin` | A counter. Each increment asks the projection to spin once. |
| `stage/wheel/result` | `{ uid, n }`, written by the projection when the spin with counter `n` lands. |
| `stage/slideshow/on` | Slideshow is on. |
| `stage/slideshow/at` | The current step, written by the projection. It replaces the cursor in local storage. |
| `stage/slideshow/step` | `{ dir, n }`. Each new `n` asks the projection to step once in `dir`. |

The projection runs the teacher's applet, so it stays the one place that animates the wheel, applies slideshow steps and talks to the applet bridge. The remote only writes requests and reads results.

## Projection

The teacher's own applet fills the viewport and stays interactive, so the teacher can still demo on it with a mouse. Nothing else is permanent. There is no controls panel, no toggle for one, no thumbnail drawer, no Pulse sheet, no chat and no private timer.

What can appear over the applet, all driven by the database:

- **Spotlight.** The spotlighted student's applet over the teacher's, view-only, with the status pill as today.
- **Shared timer.** The countdown students see, in the status bar.
- **Name wheel.** See Name wheel below. On the projection it is centred, `--space-4` from every edge, with no ✕.
- **Join screen.** The join address and the code, full screen.
- **Class rules.** As today, full screen.
- **Blank.** Solid black over everything.
- **Slideshow cues** from the applet, as today.

The slideshow toast is gone. The remote shows slideshow state instead.

Keys on the projection: while focus is on the projection, the same hotkeys as the laptop remote work there (see Hotkeys). They write the same database paths. Nothing on the projection advertises them. This keeps a teacher mid-demo from having to click back into the remote window. Any key or click on the projection also closes the join screen, the class rules or a blank, as today.

Removed from the projection: Ctrl+. and middle-click toggling, the tuck-on-click behaviour and every local copy of overlay state. Its hotkeys now write `stage` paths instead of local state. G does nothing there.

## Remote

One page with two layouts: **touch** and **laptop**. Both carry every control. They differ in density, hit size and how secondary actions are reached.

### Choosing the layout

The remote starts in touch when `(pointer: coarse)` matches and `(hover: hover)` does not. Otherwise it starts in laptop. A quiet icon button at the end of the top bar switches between them: a hand icon to go to touch, a keyboard icon to go to laptop. It carries `aria-label` "Touch layout" or "Laptop layout". The choice is saved in local storage for that device.

### What both layouts share

**Top bar.** Sticky, `--color-surface`, 1px bottom border. Left to right:

1. **Join code.** Mono, weight 700, accent. Tapping it toggles `stage/join`, and it is the selected state while the join screen is up. A quiet copy icon follows it.
2. **Presence.** Online over joined, with the person icon as its label and the success dot when everyone is online.
3. **Private timer.** Shown only while one runs. Whole minutes only, quiet, as the private countdown is today. Tapping it opens the timer controls.
4. **Projector toggles.** Three icon buttons, each the selected state while its overlay is up: Blank, Join screen and Class rules. Blank uses danger, not accent, when pressed, because the room is dark.
5. **Layout switch.**

**Stage preview.** A view-only mirror of the projection: the teacher's applet from `teacherState`, with any spotlight on top. It lets a teacher on a phone know what the class sees. It goes black while blanked. Tapping it does nothing.

**Class group.** Items 3 to 9 of Left column order: mode switcher, mode detail, Handoff, slideshow, timer, chat limit and End.

**Screens.** See Thumbnail grid. Tiles only render while scrolled into view, so a phone can carry a full class. Tile states are unchanged. Clicking or tapping a tile does what it does today in each mode. A whole-class Pulse button sits above the grid when the applet has a Pulse prompt.

**Wheel.** The wheel's controls, not the wheel itself:

- A projector toggle, selected while `stage/wheel/open` is true.
- Pool chips with counts, then No repeats and the reset icon, as today.
- Spin, primary and large. Spin also opens the wheel on the projector if it is closed.
- The last result in display size, weight 700, accent, with a Spotlight icon button. The name appears only once `stage/wheel/result` arrives, so the remote never spoils the spin.
- Chips and Spin are disabled from the spin request until its result arrives.

**Timer.** The timer controls from today: presets 1m, 3m, 5m and 10m, a custom minutes field, and the eye toggle for whether students see it. A running timer shows pause or resume, +1m, the eye toggle and cancel. The private timer lives only on the remote, in the top bar.

**Chat.** The teacher's own chat, as the drawer defines it, when the applet has instructions. The chat limit stepper sits above the messages.

**Pulse.** See Pulse sheet.

### Touch layout

Built for a thumb. Minimum hit area 48px. No hover states carry meaning, and nothing relies on a tooltip. An icon-only control whose meaning is not obvious gets a caption-size label under its icon instead.

**Phone, under 48rem wide.** The top bar, then one panel chosen by a bottom tab bar. The stage preview sits at the top of the Class tab only, 16:10 across the full width. The tab bar is sticky, 64px tall, with icon and caption label per tab:

| Tab | Holds |
| --- | --- |
| Class | the class group |
| Screens | screens, two tiles per row |
| Wheel | the wheel controls |
| Timer | the timer controls |
| Chat | chat, only when the applet has instructions |

The active tab is accent. A tab's icon gets an accent dot when something there needs the teacher: a finished Pulse in Screens, an unread reply in Chat, a finished timer in Timer. The mode switcher's buttons grow to 56px tall in a 2-column grid. On Screens, a long press on a tile opens that student's Pulse, replacing the hover icons.

**Tablet, 48rem and wider.** Two columns. The left column is `--width-controls` wide and always holds the class group, then the timer controls. The right column holds the stage preview on top and, below it, one of Screens, Wheel or Chat, chosen by a segmented control of icon and label. Pulse sheets cover the right column only.

### Laptop layout

Built for a mouse and keyboard, as dense as the old controls panel. Minimum hit area 40px. Hover tooltips with `data-tip` carry each control's name and its key in brackets, such as "Student screens (G)".

Two columns. The left column is `--width-controls` wide and holds everything in Left column order. The right column starts with a row: icon buttons for Screens, Wheel and Chat on the left, and the stage preview on the right at 16rem wide. The chosen one of Screens, Wheel or Chat fills the rest.

### Hotkeys

On the laptop remote, and invisibly on the projection. None fire while typing in a field.

| Key | Action |
| --- | --- |
| 1 to 9, 0 | Modes in switcher order |
| G | Right column to Screens |
| W | Toggle the wheel on the projector |
| Space or Enter, with Wheel showing | Spin |
| B | Toggle blank |
| J | Toggle the join screen |
| R | Toggle the class rules |
| S | Toggle slideshow |
| Right, Down, PageDown or Space, with slideshow on | Next step |
| Left, Up or PageUp, with slideshow on | Previous step |
| Esc | Close the join screen, rules or wheel on the projector, else leave a spotlight, as today |

Space steps the slideshow rather than spinning when both apply, because a clicker sends it. The touch layout has no hotkeys.

### Left column order

The laptop layout's left column, and the touch layouts' Class group, run top to bottom with `--space-6` between groups. On touch, items 1 and 2 live in the top bar instead.

1. **Join code.** Display size, mono, accent. It is the largest thing in the column.
2. **Presence.** One stat: online over joined, `--font-size-xl`, with a person icon as its label. A success dot when everyone joined is online. On laptop, quiet icon buttons follow it: Blank, Join screen and Class rules.
3. **Mode switcher.** See below.
4. **Mode detail.** Only the controls the active mode needs. Spotlight and Anonymous show the name list. Paced shows a phase stepper (−, phase number, +). Reveal shows a source picker: the teacher's current state or each prepared state by name. Group shows the group size stepper and a Shuffle action. Gallery has no detail here. Its picker is Screens.
5. **Handoff.** Primary, `--font-size-lg`, full width, in Demo only.
6. **Slideshow**, when the applet has slides. The toggle, "Step n of m", and the next step's label in caption size, muted. Two large Previous and Next buttons sit under it while slideshow is on.
7. **Timer.** See Timer above.
8. **Chat limit.** A stepper labelled with a chat icon. 0 shows as ∞.
9. **End.** Quiet and destructive, at the bottom. It asks for confirmation by turning into a danger-filled "End" on the first click. A second click within 3 seconds ends the session.

### Mode switcher

A 2-column grid of 40px-tall buttons. The ten modes fall into three groups separated by `--space-3` of extra gap. Group membership carries no heading.

| Group | Modes, in order |
| --- | --- |
| Watch | Demo, Reveal, Spotlight, Anonymous, Gallery |
| Work | Independent, Paced, Group |
| Stop | Freeze, Focus |

Labels, exactly: Demo, Reveal, Spotlight, Anonymous, Gallery, Independent, Paced, Group, Freeze, Focus. Anonymous sits directly after Spotlight so the pair reads together. The active mode is the selected state. Focus, when active, uses danger instead of accent, because the whole room is dark.

In Spotlight and Anonymous, every student is listed by name under the switcher, with a search field above them, sorted by name, like the Reveal choices. Offline students are muted with a dashed border. The spotlighted student is the selected state. Tapping a name spotlights that student, and tapping the selected one again ends the spotlight. Long names wrap.

### Thumbnail grid

Screens on the remote. Tiles auto-fill at a 12rem minimum, 16:10, `--space-3` apart. On a phone they are two per row.

A tile is the student's live applet, scaled down and non-interactive, on `--color-surface`. The student's name sits under it in caption size, weight 600. States:

| State | Look |
| --- | --- |
| offline | 40% opacity, name muted |
| spotlighted | 2px accent ring |
| in the gallery | accent ring and a filled check badge top right |
| has a Pulse | small accent dot top left |
| hover, laptop only | raised border, with Spotlight and Pulse icon buttons in the top right corner |

In Spotlight and Anonymous, clicking a tile spotlights that student. In Gallery, clicking toggles the student in and out of the gallery. In any other mode, clicking a tile opens that student's Pulse if one exists. On touch, a long press on any tile opens that student's Pulse in every mode.

### Pulse sheet

A Pulse opens in a sheet on the remote, never on the projection. In the laptop and tablet layouts it covers the right column. On a phone it covers everything below the top bar, with a quiet ✕ top right. The Pulse body is the Engine's freeform output, rendered as-is on `--color-surface`. A whole-class Pulse has no heading. A per-student Pulse shows the student's name at `--font-size-lg`. While a Pulse is pending, its button shows a moving accent bar along its bottom edge. Esc closes the sheet.

## Library (remote)

The library lives on the remote and shows whenever no session is live. A single column, max 48rem, centred. Upload is the only primary control and sits top left. Each applet is a row card: name in weight 600, then Start (primary), then a quiet ✕ that turns danger on hover. An empty library shows only the Upload button.

- **Laptop.** Dropping files anywhere on the page uploads them, and the page shows a dashed accent outline while a file is dragged over it.
- **Touch.** Upload opens the file picker. Rows are 56px tall. ✕ asks for confirmation the same way End does, since there is no hover to warn first.

## Name wheel

The wheel draws on the projection only, and the remote holds its controls. On the projection, the pool chips and No repeats show state and take no input. The reset icon and the Spotlight button exist on the remote only. A sheet centred over the stage, `--space-4` from every edge. Surface, border and overlay shadow. No ✕. Esc on either page closes it.

- **Pools.** A row of chips at the top, centred: Everyone, then each filter the applet publishes, in its order. Each chip shows its name in weight 600 and its count in caption size, muted. The chosen chip is the selected state. The chips are hidden when the applet publishes no filters. Every pool holds online students only.
- **No repeats.** A toggle chip to the right of the pools, set apart by `--space-6`. Pressed means each drawn student leaves the pool for the rest of the session, and the counts drop to match. Once anyone has been drawn, a quiet reset icon follows it and puts everyone back. The applet can set the toggle too.
- **Wheel.** A disc that fills the rest of the sheet. One slice per student, sorted by name, in three neutral tones (`--color-wheel-0` to `--color-wheel-2`) so no two neighbours match. Names run along the slice's radius in weight 600 and turn round on the left half so none reads upside down. A 1.5 unit `--color-border` rim. An accent pointer at the top.
- **Spin.** A round 5.5rem hub. On the projection it is a plain accent disc, not a button. The remote's Spin requests a spin. It spins at least five full turns over `--duration-spin` with `--ease-spin`, and lands at a random point inside the chosen slice. The same student never comes up twice running while anyone else is in the pool. The remote disables its chips and Spin mid-spin.
- **Result.** The winning slice turns accent with on-accent text. The name appears under the wheel at display size, weight 700, accent. It stays until the next spin or until the pool changes.
- An empty pool shows a bare `--color-bg` disc and a disabled Spin.

Reduced motion zeroes `--duration-spin`, so the result shows at once.

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

The teacher sees the same chat on the remote, under Chat.

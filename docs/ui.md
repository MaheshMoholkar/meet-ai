# UI design

How the web app looks, and why. The tokens live in [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css); this page is the reasoning behind them.

The interface is built from the stationery of meeting notes: blue-black **ink** on paper, a **ballpoint blue** for the agent, a **highlighter yellow** for you.

## Principles

1. **Colour means voice.** `agent` blue is the agent. `you` yellow is you. They appear where a voice does: the call screen, the recording timeline, your chat bubble, avatars. They are never decoration.
2. **Ink acts.** Buttons, focus, selected tabs and the current nav item are ink (`primary`, `ring`, `foreground`). The one exception is calling the agent: **Start meeting**, **Join meeting** and **Join call** use `variant="call"`, and nothing else does.
3. **Lines, not boxes.** Lists, summaries and transcripts sit straight on `background`, divided by `border` hairlines. `card` is for things that float: dialogs, the call lobby, menus.
4. **Sound is shown on Night.** The call screen, the recording strip and the sign-in panel are wrapped in `.dark` in both themes, so both voice colours hold 3:1 against their ground.
5. **Quiet when it is fine.** A completed meeting gets an outlined pill. There is no green. Tint is for what wants something from you: Upcoming, Active, Failed.
6. **One red.** `destructive` is for deleting, leaving a call, and things that failed.

## Tokens

| role | tokens | where |
| --- | --- | --- |
| Paper | `background`, `card`, `popover` | The canvas; things that float |
| Ink | `foreground`, `primary`, `ring` | Text, icons, the default button, focus |
| Quiet | `muted`, `muted-foreground`, `secondary`, `accent` | Hover, chips, secondary text |
| Lines | `border`, `input`, `scrim` | Hairlines; the edge of a control (3:1); the veil behind a dialog |
| The agent | `agent`, `agent-foreground`, `agent-text`, `agent-soft` | The mark, the call button, agent bars, Active |
| You | `you`, `you-foreground`, `you-text`, `you-soft`, `highlight` | Your avatar, your mic level, your bubble, Upcoming, search matches |
| Danger | `destructive`, `destructive-soft`, `destructive-solid`, `destructive-foreground` | Delete, Leave, Failed, field errors |

- A solid colour carries its own text token (`agent-foreground` on `agent`, `you-foreground` on `you`). Never literal white or black, and no Tailwind palette classes (`blue-600`, `yellow-200`, …).
- `agent`, `you` and `destructive-solid` are the same in Light and Night; their `-text` and `-soft` companions change.
- On Light, `you` is only 1.6:1 against paper: use it as a fill that carries ink, never as a lone mark or as text. Use `you-text` for that.
- Tokens that point at other tokens (`primary`, `ring`, `sidebar-*`, the `*-foreground` aliases) are declared under `:root, .dark` together. A custom property resolves `var()` where it is declared, so an alias declared on `:root` alone would stay Light inside a `.dark` surface.
- The theme switch itself is not wired up yet. Every token has its Night value; adding a `next-themes` provider with `attribute="class"` is all a toggle needs.

## Type

- **Radio Canada Big** (`font-heading`): titles only, weight 600, tracked in. Page titles are 24/30, section titles 18/26, the agent's name on a call 40/44.
- **Radio Canada** (`font-sans`): everything else. 14/22 is the interface size; 16/26 is for reading what was said (summary, transcript lines).
- **`timecode`**: timestamps, durations and counters. Radio Canada with tabular figures and its width axis at 87%. Condensed, not monospace.

## Shape

- Radius says what a thing is: `rounded-sm` inside controls, `rounded-md` for controls, `rounded-lg` for containers on the canvas, `rounded-xl` for things that float, `rounded-full` for voices and people (avatars, status pills, voice bars, the call dock).
- Shadows only under things that float: `shadow-overlay` for menus and toasts, `shadow-dialog` for dialogs.
- Focus is `focus-ring`: a solid 2px ink outline, 2px outside the element. No glow.
- Controls are 32px (`h-8`), 40px (`h-10`, `size="lg"`) in forms you fill in and for the call button.
- Icons are Lucide at 16px with a 1.75 stroke, set once in `globals.css`.

## Words

- Sentence case everywhere. Buttons are verbs that say what happens: "New meeting", "Start meeting", "Join call".
- A confirm button names what it deletes ("Delete meeting"); pass it to `useConfirm` as the third argument.
- Errors say what happened and what to do, with no apology: "Couldn't load this meeting. It may have been deleted, or it isn't yours."
- Meeting and agent names are shown as typed.

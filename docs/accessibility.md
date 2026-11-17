# Accessibility and blind mode

ligungi should be playable without seeing the board, as lichess is. The blind mode below is planned (see [roadmap.md](roadmap.md)) but not built yet; it waits for more of the site to settle. This document keeps it from falling behind: it holds the design, a map of every screen with what blind mode will need there, and the checklist for anyone adding or changing a screen.

**Rule:** a change that adds a screen, or changes how one is played or read, updates the screen map below in the same change (see AGENTS.md).

## Blind mode: the design

Proposed in November 2026, to be reviewed before it is built.

### Turning it on

- A setting, "Mode for screen readers", in Settings (kept in the browser, like the other display preferences).
- A link to it at the top of the sign in and sign up pages, where a screen reader user meets it first, as on lichess.

### On a game page

The visual board stays on screen for a sighted helper, hidden from screen readers (`aria-hidden`). In its place the page gains its own region with three parts.

**1. Announcements** (an `aria-live` region), read as they happen, with the piece names of the chosen language:

- a move: "White: Samurai from 4-8 to 4-7, stacked on the white Soldier, tier 2."
- a capture: "Black: Spear from 5-3 captures on 5-4. The white Samurai leaves."
- a drop: "White drops a Ninja from the hand on 4-7, tier 1."
- a betrayal: "Betrayal: the black Soldier on tier 1 turns white."
- the draft: "Black declared done." / "The draft is over, the game starts."
- "Check on your Marshal." / "Your last 20 seconds." / "Game over: Black wins by resignation."

**2. A command field**: type a move or a request, then Enter.

| Typed | Answer |
|---|---|
| `4-7 samurai` | plays the move when a single Samurai can reach 4-7 |
| `4-8 4-7` | moves the piece on 4-8 to 4-7; asks which action when it could move, stack or capture |
| `ninja 4-7` | drops the Ninja from the hand on 4-7 |
| machine notation (`e2e3`, `N*e4`) and the rulebook's with kanji | for players who know them |
| `p` | the position: "White: Marshal on 5-1; Samurai on 4-7, top of a tower of 2, over a white Soldier; ...", then Black |
| `c 4-7` | one square: "4-7, tower of 2: tier 1 white Soldier, tier 2 black Samurai." |
| `m` | both hands: "Your hand: 2 Soldiers, 1 Ninja. Black's hand: ..." |
| `l 4-7` | the moves of the piece on 4-7: "Samurai on 4-7 can move to 4-6, capture on 3-6, stack on 5-6." |
| `u` | the last move |
| `r` | the clocks |
| `done`, `resign`, `draw`, `help` | what they say |

An ambiguous move lists numbered options ("1: Samurai from 4-8. 2: Samurai from 5-8."); typing the number picks one. Short letters and whole words both work (`p` or `position`), in the interface language.

**3. The board by keyboard** (optional): the 81 squares as buttons. Arrow keys move between them, each square is read ("4-7, black Samurai over white Soldier, tier 2"), Enter picks a piece and then its destination. The hands are a list under it.

It brings the keyboard move input of the backlog with it. The engine already turns moves into rulebook text (`moveToRulebook`) and matches rulebook text against the legal moves (`parseGameRecord`), so the typed input builds on that.

### Testing

- VoiceOver (macOS, iOS) and NVDA (Windows), plus an automated check (axe) on each screen.
- Before calling it done, a player who uses a screen reader every day tries it.

## Screen map

What each screen shows only visually today, and what blind mode needs there. Status: **planned** (in the design above), **to design** (needs its own design when we get there), **ok** (works with a screen reader as it is, to be checked).

| Screen | Path | Visual only today | Blind mode needs | Status |
|---|---|---|---|---|
| Online game | `/<id>` | board, hands, last move, clocks, tower inspector | announcements, command field, board by keyboard, clocks on request | planned |
| Against the computer | `/computer` | same as an online game, level choice | same as an online game | planned |
| TV and its channels | `/tv`, `/tv/<channel>` | boards of the live games, clocks | announcements of the followed game, position on request | planned |
| Analysis board | `/analysis` | board, move tree | the command field for moves, the move list as text, stepping through moves with announcements | to design |
| Study | `/study/<id>` | board, move tree with variations, arrows and painted squares | as the analysis board, plus the comment of each move read with it, the drawings read as text ("green arrow from 5-7 to 5-5; red square on 4-5"), and for the author typed commands to draw and erase them | to design |
| Study list and forms | `/study`, (dialogs) | none: text cards, forms from `ui.tsx` | check the labels read well | ok |
| Board editor | `/editor` | placing pieces by click | placing and removing pieces by typed commands (`4-7 white samurai`), the position read back | to design |
| Puzzles, puzzle of the day | `/puzzles`, `/puzzles/<id>`, `/puzzles/daily` | board, the task, right and wrong marks | the task read, the position on request, moves typed, feedback announced (already in a `role="status"` element) | to design |
| Puzzle Streak and Storm | `/streak`, `/storm` | board, clock, combo | as puzzles, plus the clock and combo read on request and the bonus or penalty announced | to design |
| Lessons | `/lessons/...` | board, goal marks on squares | the goal read (including the marked squares), moves typed, the result announced | to design |
| Practice | `/practice/<id>` | board against the computer, moves left | as a game against the computer, plus the goal and the moves left | to design |
| Coordinate trainer | `/coordinates` | a board of square buttons | the squares already are buttons with labels; the "find" mode needs its prompt announced | to design |
| Draft explorer | `/explorer` | board, result bars | the placements table already reads as text; the bars need their numbers (they have an `aria-label`), the path read | to design |
| Home | `/` | mini boards (puzzle of the day, live game), quick pairing | the boards described in text, the rest is buttons and links | to design |
| Create a game dialog | (dialog) | sliders, segmented choices | real radio inputs and range inputs already; check the labels read well | ok |
| Profile, players, ranking, friends | `/@/<name>`, `/players`, `/ranking`, `/friends` | rating chart, rating distribution | the charts have a table or text alternative (check each) | to design |
| Rules page | `/learn` | piece movement diagrams | each diagram described in text | to design |
| Settings, account, sign in, info pages | `/settings`, `/account`, `/login`, `/about`... | swatches, previews | forms from `ui.tsx` with labels; previews are decoration | ok |

## Checklist for a new or changed screen

- Every control is a real `<button>`, `<a>` or form input with a name a screen reader can read (`aria-label` on icon-only buttons).
- Anything that changes on its own (a move, a result, a timer running out) is also announced in text, not only drawn.
- Anything shown on a board or a chart can also be read as text.
- The screen map above says what blind mode will need on this screen.

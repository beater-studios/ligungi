# Accessibility and blind mode

ligungi should be playable without seeing the board, as lichess is. The blind mode below (the screen reader mode) is built on every screen of the map. What is left is on the [roadmap](roadmap.md): a test with a player who uses a screen reader every day, and an automated check. This document keeps it from falling behind: it holds the design, a map of every screen with what blind mode needs there, and the checklist for anyone adding or changing a screen.

**Rule:** a change that adds a screen, or changes how one is played or read, updates the screen map below in the same change (see AGENTS.md).

## Blind mode: the design

Proposed and built in November 2026: turning it on, the announcements, the command field and the board by keyboard, on every screen with a board (see the map).

### Turning it on

- A setting, "Screen reader mode", in Settings (kept in the browser, like the other display preferences).
- A switch at the top of the sign in and sign up pages, where a screen reader user meets it first, as on lichess.

### On a game page

The visual board stays on screen for a sighted helper, hidden from screen readers (`aria-hidden`). In its place the page gains its own region (`BlindPanel`, right under the board, with the cursor in its field on arrival) with three parts. The texts live in `t.blind` of the dictionaries, and the logic (descriptions, typed moves and commands) in `apps/web/src/blind.ts`, tested in `apps/web/test/blind.test.ts`.

**1. Announcements** (a `role="log"` region, `aria-live="polite"`), read as they happen, with the piece names of the chosen language. The answers to the commands go to the same log.

- a move: "White: Samurai from 4-8 to 4-7, stacked on the white Soldier, tier 2."
- a capture: "Black: Spear from 5-3 captures on 5-4. The white Samurai leaves."
- a drop: "White drops a Ninja from the hand on 4-7, tier 1."
- a betrayal: "Betrayal: the black Soldier on tier 1 turns white."
- the draft: "Black declared done." / "The draft is over, the game starts."
- "Check: the black Marshal is attacked." / "Your last 20 seconds." / "Black wins by resignation."
- in online games, a draw offer or a takeback proposal from the opponent, and a declined offer.

**2. A command field**: type a move or a request, then Enter.

| Typed | Answer |
|---|---|
| `4-7 samurai` (or `samurai 4-7`, `sam 4-7`) | plays the move when a single Samurai, on the board or in the hand, can reach 4-7 |
| `4-8 4-7` | moves the piece on 4-8 to 4-7; lists the actions when it could move, stack or capture |
| `ninja 4-7` | drops the Ninja from the hand on 4-7 (or moves one there, listing both when both are possible) |
| `capture`, `stack`, `betray`, `new` and a tier (`4-7-2`) | narrow the choice |
| machine notation (`e2e3`, `N*e4`) and the rulebook's, with kanji or piece names | for players who know them |
| `p` | the position: "White: Marshal on 5-1; Samurai on 4-7, top of a tower of 2, over a white Soldier; ...", then Black |
| `c 4-7` | one square: "4-7, tower of 2: tier 1 white Soldier, tier 2 black Samurai." |
| `m` | both hands: "Your hand: 2 Soldiers, 1 Ninja. Black's hand: ..." |
| `l 4-7` | the moves of the piece on 4-7: "Samurai on 4-7 can move to 4-6, capture on 3-6, stack on 5-6." |
| `u` | the last move |
| `r` | the clocks |
| `done`, `resign` (typed twice to confirm), `draw` (offers, or accepts an offer), `help` | what they say; `resign` and `draw` only in online games |

An ambiguous move lists numbered options ("1: Samurai from 4-8. 2: Samurai from 5-8."); typing the number picks one. Short letters and whole words both work (`p` or `position`), in the interface language.

**3. The board by keyboard**, under the log, folded by default (`<details>`): the 81 squares as buttons. Arrow keys move between them, each square is read ("4-7, black Samurai over white Soldier, tier 2"), Enter picks a piece and then its destination. The hands are a list under it.

It brings the keyboard move input of the backlog with it. The engine already turns moves into rulebook text (`moveToRulebook`) and matches rulebook text against the legal moves (`parseGameRecord`), so the typed input builds on that.

### Beyond the game pages

The same panel (`BlindPanel`) serves every screen with a board, with what each screen adds:

- **Stepping through moves** (`<`, `>`, `start`, `end`): each step reads the move reached ("Move 12. White: ..."), and going back to the current move says so. Typing a move while looking at an earlier one brings the board back to the current move first (game pages); on the analysis board and in studies it is played from there, as on the visual board.
- **A goal** (`g`), read on arrival: the task of a puzzle, the instruction of a lesson with its marked squares, the goal of a practice position. `r` reads the puzzle run's timer, score and combo, or the moves used in a practice position or a lesson.
- **Studies:** each move is read with its comment, its drawings ("red arrow from 5-7 to 5-5; square 4-5 painted blue") and the variations that start there (`v 2` enters one). The author draws with `arrow 5-7 5-5 red` and `paint 4-5 blue` (the same command erases), `clear` erases the move's drawings, `d` reads them again.
- **Board editor:** `4-7 white samurai` puts a piece on top of a square, `remove 4-7` takes the top one off, `hand black samurai` and `remove hand black samurai` change the hands, `clear` empties the board, `turn black` picks who moves. The problems of the position are read as they change.
- **Coordinate trainer:** each square is read by where it stands ("column 3 from the left, row 5 from the top"), since turning that into the square's name is the skill trained; the marked square of the name mode is read the same way, and right or wrong is announced.
- **Small boards** (home, TV, lists) are decoration beside text that says the same; the rules page's movement diagrams are read as the squares each tier reaches. The rating distribution has its bands as a list.

### Testing

- VoiceOver (macOS, iOS) and NVDA (Windows), plus an automated check (axe) on each screen. Not done yet: every screen was checked in a browser (focus, the board hidden from screen readers, the log filling in, typed moves and commands, the board by keyboard) but not with a real screen reader.
- Before calling it done, a player who uses a screen reader every day tries it.

## Screen map

What each screen shows only visually, and what blind mode needs there. Status: **built** (the screen reader mode covers it), **planned** (in the design above), **to design** (needs its own design when we get there), **ok** (works with a screen reader as it is, to be checked).

| Screen | Path | Visual only today | Blind mode needs | Status |
|---|---|---|---|---|
| Online game | `/<id>` | board, hands, last move, clocks, tower inspector | announcements, command field, board by keyboard, clocks on request | built |
| Against the computer | `/computer` | same as an online game, level choice | same as an online game | built |
| TV and its channels | `/tv`, `/tv/<channel>` | boards of the live games, clocks | announcements of the followed game, position on request | built (a channel is the online game page) |
| Analysis board | `/analysis` | board, move tree | the command field for moves, the move list as text, stepping through moves with announcements | built |
| Study | `/study/<id>` | board, move tree with variations, arrows and painted squares | as the analysis board, plus the comment of each move read with it, the drawings read as text ("green arrow from 5-7 to 5-5; red square on 4-5"), and for the author typed commands to draw and erase them | built |
| Study list and forms | `/study`, (dialogs) | none: text cards, forms from `ui.tsx` | check the labels read well | ok |
| Board editor | `/editor` | placing pieces by click | placing and removing pieces by typed commands (`4-7 white samurai`), the position read back | built |
| Puzzles, puzzle of the day | `/puzzles`, `/puzzles/<id>`, `/puzzles/daily` | board, the task, right and wrong marks | the task read, the position on request, moves typed, feedback announced (already in a `role="status"` element) | built |
| Puzzle Streak and Storm | `/streak`, `/storm` | board, clock, combo | as puzzles, plus the clock and combo read on request and the bonus or penalty announced | built |
| Lessons | `/lessons/...` | board, goal marks on squares | the goal read (including the marked squares), moves typed, the result announced | built |
| Practice | `/practice/<id>` | board against the computer, moves left | as a game against the computer, plus the goal and the moves left | built |
| Coordinate trainer | `/coordinates` | a board of square buttons | the squares already are buttons with labels; the "find" mode needs its prompt announced | built |
| Draft explorer | `/explorer` | board, result bars | the placements table already reads as text; the bars need their numbers (they have an `aria-label`), the path read | built |
| Home | `/` | mini boards (puzzle of the day, live game), quick pairing | the boards described in text, the rest is buttons and links | built (the small boards are decoration) |
| Create a game dialog | (dialog) | sliders, segmented choices | real radio inputs and range inputs already; check the labels read well | ok |
| Profile, players, ranking, friends | `/@/<name>`, `/players`, `/ranking`, `/friends` | rating chart, rating distribution | the charts have a table or text alternative (check each) | built (the rating history has a table, the distribution a list) |
| Rules page | `/learn` | piece movement diagrams | each diagram described in text | built (diagrams and piece trainer) |
| Settings, account, sign in, info pages | `/settings`, `/account`, `/login`, `/about`... | swatches, previews | forms from `ui.tsx` with labels; previews are decoration | ok |

## Checklist for a new or changed screen

- Every control is a real `<button>`, `<a>` or form input with a name a screen reader can read (`aria-label` on icon-only buttons).
- Anything that changes on its own (a move, a result, a timer running out) is also announced in text, not only drawn.
- Anything shown on a board or a chart can also be read as text.
- The screen map above says what blind mode will need on this screen.
- When the screen reader mode reaches a new screen, also update what the site says about it: the screen reader question of the FAQ (`src/i18n/content/`), `accessibilitySummary` in the home's JSON-LD (`src/seo.ts`) and the summary of `llms.txt` (`scripts/prerender.ts`).

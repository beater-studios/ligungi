# Gungi rules (ligungi specification)

This specification follows the official 2022 rules (a Universal Music product, rules by the "HUNTER×HUNTER 軍儀 特別チーム", supervised by Shueisha). It is the reference for the rules engine: when the code and this document disagree, one of them is wrong.

Sources, in order of authority:

1. `references/komugi-gungi-engine/gungi_rulebook_jp.pdf`: the official rulebook in Japanese (軍儀解説書).
2. [Official Universal Music FAQ](https://www.universal-music.co.jp/other/hunter-gungi__qa/) (Q1 to Q30): clarifications and one rulebook erratum. Cited here as "FAQ Qn".
3. [English translation](https://planetbanatt.net/docs/gungi_rulebook_en.pdf) of the same rulebook (faithful to the original, checked page by page).
4. `references/komugi-gungi-engine/komugi_engine_v4_6.h`: an engine that implements the official rules. Useful to check movements, but it differs from the rulebook and the FAQ on a few points (listed in section 11).
5. [軍儀Web](https://gungi.2410.dev/rules.html) (copy in `references/軍儀のルール.html`): a Japanese online play site that states it follows the official rules (UMSルール準拠). A secondary source, useful where the rulebook is silent.
6. `references/Learn _ Gungi.html` (current gungi.io): a reference for how an online platform handles the rules. Not a rules source.

The `references/` folder is not versioned (it holds third-party material); see [references/README.md](../references/README.md).

The fandom wiki page (Hunterpedia) only describes what appears in the manga (chapters 244 to 318) and has no playable rules. The Reddit post "Gungi: the official rules" (2021) and its image archive predate the product release. They were superseded by the rulebook and only serve as visual support. The `gungi-3`, `gungi` (khantram) and legacy `gungi.io` references follow pre-2022 fan rules (different pieces, counts and movements) and must not be used for rules.

## 1. Overview

- 2 players, White and Black, 25 pieces each (14 types).
- 9x9 board. The 3 rows closest to each player are their starting territory (自陣).
- A player wins by capturing the opposing Marshal (帥), by checkmate, or when the opponent resigns.
- Pieces can be stacked (ツケ, tsuke) into towers of up to 3 tiers (2 in some modes). The height of the tower a piece stands on (its "tier", 段) extends its reach and defines what it can capture.

## 2. Pieces

| Kanji | Reading | Name (en) | Name (pt) | Count | id |
|---|---|---|---|---|---|
| 帥 | sui | Marshal | Marechal | 1 | `marshal` |
| 大 | taishō | General | General | 1 | `general` |
| 中 | chūjō | Lieutenant General | Tenente-General | 1 | `lieutenant` |
| 小 | shōshō | Major General | Major-General | 2 | `major` |
| 侍 | samurai | Samurai / Warrior | Samurai | 2 | `samurai` |
| 槍 | yari | Spear / Lancer | Lanceiro | 3 | `lancer` |
| 馬 | kiba | Knight / Rider | Cavaleiro | 2 | `rider` |
| 忍 | shinobi | Spy | Ninja | 2 | `spy` |
| 砦 | toride | Fortress | Fortaleza | 2 | `fortress` |
| 兵 | hyō | Pawn / Soldier | Soldado | 4 | `soldier` |
| 砲 | ōzutsu | Cannon | Canhão | 1 | `cannon` |
| 弓 | yumi | Archer | Arqueiro | 2 | `archer` |
| 筒 | tsutsu | Musketeer | Mosqueteiro | 1 | `musketeer` |
| 謀 | bōshō | Captain / Tactician | Estrategista | 1 | `tactician` |

Total: 25. Cannon, Archer, Musketeer and Tactician are the "special pieces" (特殊駒).

## 3. Movement

### 3.1 Conventions

- Directions from the mover's point of view: N = forward, S = backward, E/W = sideways, NE/NW = forward diagonals, SE/SW = backward diagonals.
- `t` = tier of the moving piece (1, 2 or 3), that is, the height of the tower whose top it occupies.
- Each direction of a piece is a ray with base range `b`. At tier `t` the range is `b + (t - 1)`: the piece can stop on any square at distance 1..`b + t - 1`.
- "Unlimited" ray (∞): slides to the edge; it does not change with the tier.
- Normal movement does not jump: any piece (of any height) on an intermediate square blocks the ray.

### 3.2 Movement table (normal pieces)

| Piece | Directions and base range |
|---|---|
| 帥 Marshal | N, NE, E, SE, S, SW, W, NW: 1 |
| 大 General | N, E, S, W: ∞ ; NE, NW, SE, SW: 1 |
| 中 Lieutenant General | NE, NW, SE, SW: ∞ ; N, E, S, W: 1 |
| 小 Major General | N, NE, NW, E, W, S: 1 |
| 侍 Samurai | N, NE, NW, S: 1 |
| 槍 Lancer | N: 2 ; NE, NW, S: 1 |
| 馬 Knight | N, S: 2 ; E, W: 1 |
| 忍 Ninja | NE, NW, SE, SW: 2 |
| 砦 Fortress | N, E, W, SE, SW: 1 |
| 兵 Soldier | N, S: 1 |
| 謀 Tactician | NE, NW, S: 1 |

Examples: a Knight at tier 3 goes up to 4 squares forward or backward and 3 sideways; a Ninja at tier 2 goes up to 3 squares diagonally.

### 3.3 Jumping pieces (砲 筒 弓)

These three pieces have a forward jump. When jumping, occupied intermediate squares do not block, as long as the intermediate tower is no taller than `t`. An intermediate tower taller than `t` blocks. This applies to own and enemy pieces alike. The other directions of these pieces are normal rays (no jump).

| Piece | Forward jump (destination squares) | Normal rays |
|---|---|---|
| 砲 Cannon | N, distance 3..`2 + t` | E, W, S: 1 |
| 筒 Musketeer | N, distance 2..`1 + t` | SE, SW: 1 |
| 弓 Archer | see below | S: 1 |

The ranges of lower tiers stay valid: a Cannon at tier 3 can land 3, 4 or 5 squares away.

Archer, jump destinations as (dx, dy) coordinates, dy forward:

- tier 1: (0, 2), (-1, 2), (+1, 2)
- tier 2: adds (0, 3), (-2, 3), (+2, 3)
- tier 3: adds (0, 4), (-3, 4), (+3, 4)

Archer intermediate squares (the ones that must be no taller than `t`): every square crossed by the straight segment from the center of the Archer's square to the center of the destination square, excluding origin and destination. The arrow flies in a straight line. This gives:

| Destination | Intermediate squares |
|---|---|
| (0, d) | (0, 1)..(0, d - 1) |
| (±1, 2) | (0, 1), (±1, 1) |
| (±2, 3) | (0, 1), (±1, 1), (±1, 2), (±2, 2) |
| (±3, 4) | (0, 1), (±1, 1), (±1, 2), (±2, 2), (±2, 3), (±3, 3) |

This model is the only one that matches the 7 images of FAQ Q21. They show, for example, that a tower of 2 at (0, 1) blocks all three destinations of a tier 1 Archer, that a tower of 2 at (+1, 1) blocks (+1, 2) but not (0, 2), and that a tall tower at (0, 2) blocks only (0, 2) and (0, 3), leaving the diagonals free. None of the lines above passes exactly through a square corner, so there is no "corner" ambiguity.

## 4. Destination of a move

Let `h` be the height of the destination tower and `max` the stacking limit of the mode (2 or 3).

- Empty square: the piece moves there.
- Own top: the piece may stack (ツケ) if `h <= t`, `h + 1 <= max` and the top is not the Marshal.
- Enemy top: if `h > t`, no action is possible. Capturing and stacking only look at the top: an enemy piece covered by an own piece cannot be captured (FAQ Q26, Q27). If `h <= t`, the player chooses:
  - Capture (取): every enemy piece in the tower leaves the game (you cannot pick only some of them, FAQ Q28); own pieces that were in the tower stay, in the same relative order, and the moving piece ends on top (FAQ Q17).
  - Stack (ツケ): the piece goes on top of the tower without capturing, as long as `h + 1 <= max` and the top is not the Marshal.
- Only the top piece of a tower moves. When it leaves, the piece below becomes the top again and moves with the tier of the remaining tower.
- The Marshal can never be covered, by a move or by a drop, in any mode. Consequently, it is always on top of its tower.
- The Marshal may stack onto other pieces only in the modes where "帥ツケ" is allowed (Intermediate and Advanced, FAQ Q14). The Marshal may always capture.
- Captured pieces leave the game for good (unlike shogi, they do not go to the hand).

## 5. Drop (新, arata)

Instead of moving, a player may place a piece from their hand on the board. This uses the turn.

- Destination: an empty square, or a tower whose top is an own piece other than the Marshal, respecting `h + 1 <= max`. Dropping on an enemy piece is not allowed, nor on a tower with an own piece below and an enemy piece on top (FAQ Q29).
- Zone: the destination row cannot be ahead of the row of the most advanced own piece on the board. That piece's row is allowed (inclusive). The zone is not limited to the starting territory: if your most advanced piece is on row 4 (counting from you), you may drop on rows 1 to 4.
- To find the "most advanced piece", only own pieces on top of their towers count (towers of 1 included). Own pieces covered by any piece do not count (FAQ Q25).

## 6. Tactician's betrayal (寝返り)

- When the Tactician stacks (does not capture) onto a tower with an enemy top, in the same move the player may swap the enemy pieces of the tower for pieces of the same type from their hand. The swapped enemy pieces leave the game; the hand pieces take the same positions in the tower.
- If the Tactician captures, there is no betrayal: the capture removes every enemy piece in the tower (FAQ Q28).
- The effect applies to the directly covered piece and to the pieces below it.
- It is optional (FAQ Q23), but all or nothing: when betraying, every enemy piece in the tower is swapped. It is only possible if the hand holds a matching piece for each of them, in type and number (軍儀Web). Example: on a tower with an enemy Soldier and Knight, you need a Soldier and a Knight in hand; with only the Soldier, there is no betrayal.
- With no matching piece in hand, there is no swap (FAQ Q22).
- It can only be done in the move in which the Tactician is placed on the tower.
- The same applies when the Tactician is dropped on an own tower (own top) that contains an enemy piece below. The rulebook mentions this case, and FAQ Q30 corrects its text: the own 2-tier tower is "○● or ○○" (own on top), which becomes "○○○" with the betrayal.
- It also applies when the Tactician moves (stacking, without capturing) on top of an own tower that contains an enemy piece below. In short: whenever the Tactician lands by ツケ, by move or by drop, on a tower with enemy pieces, it may betray them.
- The Marshal cannot be betrayed (it is never below another piece).

## 7. Setup

### 7.1 Draft (Intermediate and Advanced modes)

1. The first player (先手) is decided. As in the rulebook, color and order are independent: either color may start. On the platform, both are set when the game is created (the challenger's choice or a random draw).
2. Starting with the first player, each player places one piece at a time in their starting territory (3 rows).
3. Each player's first piece must be the Marshal.
4. Stacking is allowed during the draft (up to `max`), except on the Marshal. Only own pieces exist in the starting territory, so only own stacking happens.
5. After placing a piece, a player may declare "済み" (done). A player who declared does not place more pieces.
6. If the first player declares done, the second may keep placing pieces. The draft ends when the second player declares done.
7. If the second player declares done before the first, the draft ends immediately for both, even if the first player still wanted to place pieces. This balances the advantage of moving first. The rulebook says the draft ends "the moment the second player declares done", and 軍儀Web and kyproduce.com say the same explicitly.
   - A second player who places all of their pieces also ends the draft, as if they had declared done.
   - **Platform option, free draft:** in casual games, the game creator can choose that the draft only ends when both players declare done. Each player then places as many pieces as they want, as gungi.io does. Rated games always use the rulebook rule.
8. Pieces not placed stay in the hand for drops.
9. The game starts with the draft's first player (FAQ Q20).

### 7.2 Fixed setups (Introductory and Beginner modes)

Coordinates in the rulebook format: columns 9..1 from left to right and rows 1..9 from top to bottom, as seen by White. Black occupies rows 1 to 3, White rows 7 to 9. The setups are symmetric under a 180 degree rotation.

Setup 1 (Introductory):

| Row | Pieces (column:piece) |
|---|---|
| 1 (Black) | 6:中 5:帥 4:大 |
| 2 (Black) | 8:忍 5:槍 2:忍 |
| 3 (Black) | 9:兵 7:砦 6:侍 5:兵 4:侍 3:砦 1:兵 |
| 7 (White) | 9:兵 7:砦 6:侍 5:兵 4:侍 3:砦 1:兵 |
| 8 (White) | 8:忍 5:槍 2:忍 |
| 9 (White) | 6:大 5:帥 4:中 |

Each player's hand: 小 x2, 槍 x2, 馬 x2, 兵 x1. Out of the game: 砲, 筒, 弓 x2, 謀.

Setup 2 (Beginner):

| Row | Pieces (column:piece) |
|---|---|
| 1 (Black) | 6:中 5:帥 4:大 |
| 2 (Black) | 8:馬 7:弓 5:槍 3:弓 2:忍 |
| 3 (Black) | 9:兵 7:砦 6:侍 5:兵 4:侍 3:砦 1:兵 |
| 7 (White) | 9:兵 7:砦 6:侍 5:兵 4:侍 3:砦 1:兵 |
| 8 (White) | 8:忍 7:弓 5:槍 3:弓 2:馬 |
| 9 (White) | 6:大 5:帥 4:中 |

Each player's hand: 小 x2, 槍 x2, 忍 x1, 馬 x1, 兵 x1. Out of the game: 砲, 筒, 謀.

## 8. Modes

| Mode | Setup | Special pieces | Max stacking | Marshal stacks |
|---|---|---|---|---|
| Introductory (入門編) | Setup 1 | none | 2 | no |
| Beginner (初級編) | Setup 2 | 弓 only | 2 | no |
| Intermediate (中級編) | Draft | all | 2 | yes |
| Advanced (上級編) | Draft | all | 3 | yes |

Advanced is the full game and should be the default for rated games.

## 9. End of the game

The rulebook and FAQ Q10 define:

- Victory by capturing the opposing Marshal.
- Victory by 詰み (mate): the opposing Marshal cannot escape capture, even if it has not been captured yet.
- Defeat for whoever declares 投了 (resignation).
- A draw ("play again") when the same position occurs 4 times (千日手).

The rulebook does not forbid moves that leave your own Marshal capturable: whoever does that simply loses when the opponent captures. The platform implements it this way, with the same result as the rulebook:

- A move that exposes the Marshal: not offered. Such a move would only lead to the Marshal's capture (a loss), so blocking it prevents losses by misclick without changing the result of any position where the opponent captures.
- Mate: the player to move has no move that keeps the Marshal safe. The opponent wins, whether the Marshal is attacked right now or not. This follows the rulebook: if every move exposes the Marshal, the capture is unavoidable. Unlike chess and gungi.io, there is no "stalemate is a draw".
- Repetition: the same position (board, hands and player to move) for the fourth time. Draw.
- Insufficient material (a platform convention, not in the rulebook): only the two Marshals are left on the board and both hands are empty. Draw, because neither can capture the other without exposing itself first.
- On top of that, the usual platform rules: timeout, resignation, draw by agreement, leaving the game. The rulebook does not define time (FAQ Q11); time controls belong to the platform.

Drops count as moves that can save the Marshal.

## 10. Notation

Rulebook notation (for display): `column-row-tier piece`, and `新` for a drop. Examples: `4-7-2 侍` (a Samurai from 4-8 stacked on the Soldier at 4-7, ending at tier 2) and `4-7-2 忍新` (a Ninja dropped on 4-7, tier 2). The machine notation (the equivalent of FEN/SFEN), with its own markers for capture and betrayal, is described in [api.md](api.md). The site can also show the rulebook notation with the piece name in the player's language instead of the kanji, `+` for a piece from the hand, `×` for a capture and `⇄` for a betrayal (`4-7-2 +Ninja`); it is a display option, not a separate notation. With the machine notation chosen, the board coordinates switch to its squares (`a` to `i`, `1` to `9`); otherwise they follow the rulebook numbers.

## 11. Interpreted points

Where the rulebook is ambiguous, or where Komugi differs from the rulebook and the FAQ, we decided as follows:

1. **Drops outside the starting territory.** Komugi limits drops to the 3 starting rows. The text and the diagram on page 10 show the zone going from the edge to the most advanced piece, beyond the 3 rows. We follow the rulebook.
2. **Marshal stacking.** Komugi forbids the Marshal from stacking in every mode. The rulebook and FAQ Q14 say only the Introductory and Beginner modes forbid it. We follow the rulebook.
3. **All-or-nothing betrayal.** The rulebook says the swap is "任意" (optional) and FAQ Q23 confirms that betraying is optional, but neither says whether you can swap only some pieces of the tower. 軍儀Web says explicitly that every enemy piece must be swapped, and the rulebook example shows all of them swapped. Komugi is also all or nothing, but only looks at the type of the top piece. We follow 軍儀Web. Partial swaps only appear as speculation on a blog.
4. **Betrayal by drop and on an own tower.** Komugi does not implement betrayal by drop. The rulebook mentions it and FAQ Q30 confirms it (with an erratum). The rulebook justifies the drop case by saying that "ツケ by drop on an own tower is also possible", which we read as: the rule applies to any ツケ of the Tactician on a tower with enemy pieces, including moving on top of an own tower with an enemy piece below. 軍儀Web says it explicitly: "unlike capturing, betrayal is possible even if the top of the destination is an own piece". The idea that "only the Tactician can be dropped on an enemy piece", found on blogs, comes from the misprint corrected by FAQ Q30.
5. **Archer intermediate squares.** The rulebook only shows the destinations. Komugi ignores the (0, 1) square for the diagonals, which contradicts image 3 of FAQ Q21. We adopt the straight line (section 3.3), which matches all 7 images. The 2021 Reddit material marked only (0, 1) as a jumped square, which contradicts image 1.
6. **Most advanced piece for drops.** FAQ Q25 settles it: only own pieces on top count. Komugi also counts covered ones.
7. **Exposing your own Marshal.** The rulebook does not forbid it. The platform does not offer such a move, and declares mate when there is no safe move, attacked or not (section 9). The result is the same as in the rulebook. The only practical difference: in the rulebook, whoever exposes their Marshal only loses if the opponent notices and captures; here that move does not exist. We do not adopt the gungi.io rule where having no safe move without being attacked is a draw: that changes the rulebook result.
8. **End of the draft.** gungi.io lets the first player keep going after the second declares done. By default we follow the rulebook (section 7.1, item 7), confirmed by 軍儀Web and kyproduce.com. The gungi.io rule exists as the "free draft" option, in casual games only.
9. **First player.** We follow the rulebook: color and order are independent. Whoever starts the draft starts the game (FAQ Q20). In the fixed setups, the setup is the same and only who moves first changes.
10. **Insufficient material.** Not in the rulebook. We adopt it to end games that have no way to finish.

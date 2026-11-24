# Changelog

Notable changes to ligungi. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). The site and the server share one version, set in the root `package.json`; the footer shows it together with the commit of the build.

## [Unreleased]

### Added

- A notice at the bottom of the page when the internet connection drops, which stays until it comes back and then says so; games and other live pages reconnect at once.
- A "no connection" page, in your language, when a page of the site is opened or reloaded without internet, instead of the browser's error.

### Changed

- The installed app's name, description and shortcuts are now in English, and the install dialog shows screenshots of the site.

### Fixed

- In the 3D view, wooden koma pieces stay inside their square: the point of your pieces and the top edge of the opponent's no longer cross into the square behind, and the far row is no longer cut by the edge of the board.

## [0.9.2] - 2026-11-23

### Added

- Link your account to the community Discord server (Account > Profile): a rank role named after a piece, from your best established rating across the modes (大 General 2000+, 中 Lieutenant General 1800+, 小 Major General 1650+, 侍 Samurai 1500+, 兵 Soldier below), given and moved by the bot after each rated game, and the Verified player role through Discord's Linked Roles, which also shows your ligungi profile on Discord. A provisional rating gives no rank yet. Leaving the server puts the link on hold until you check again from the account page; unlinking removes the roles. The privacy policy explains what is shared.
- Opponent's pieces (Settings > Preferences > Display and the Pieces menu of the quick settings, with the kanji or letters styles): turned toward the opponent, as before, or in the same direction as your own, so their kanji and letters are easier to read. The movement guides and the koma's point still turn toward the opponent, since they show where a piece moves and whose it is.

### Changed

- Home: visitors who are not signed in and have not started the lessons see, in the quick game above the time controls, a line pointing to the first lesson and to the computer in Beginner mode, so they find them before joining a queue of the full game.
- Secondary buttons (Hint, Start over, Cancel and the like) now have an outline everywhere, so they read as buttons on touch screens too instead of looking like plain text. In the lessons, Hint sits next to Start over.

### Fixed

- Profile links to libaduk now open the player's profile (`libaduk.com/profile/<name>`); the old address led nowhere.
- The tower strip on phones (Tower on tap: strip) no longer shows a scroll bar when a tall tower does not fit: the row still scrolls and fades at the edge.

## [0.9.1] - 2026-11-21

### Security

- The server uses ws 8.23.0, which fixes a denial of service where a client could exhaust the server's memory by flooding it with pings.

### Changed

- The FAQ says where to talk with other players (the Discord server), and bug reports and help can now go through the Discord too.
- Search engines and AI assistants learn about the community: llms.txt links the Discord server, the source code and the changelog, and the home page's structured data links the site's GitHub, AlternativeTo and Discord pages.

## [0.9.0] - 2026-11-20

### Added

- A Discord server for the community (ligungi.org/discord): chat in English, Portuguese and Spanish, strategy, your games, help and feedback. Linked from the footer and the contact page.
- Sound sets (Settings > Preferences > Play): Default, Piano, Futuristic and 8-bit, the free sets by Enigmahack from lila. Each one changes every sound of the site, and picking one plays a sample.
- A sound of its own when a move leaves the other side's Marshal attacked, in every set.
- Byo-yomi count with the sound set's countdown, second by second, besides the beep and the voice (the spoken count switch became this three-way choice, and players who had it on keep the voice).
- Friendly sites (`/sites`, in the footer and beside About and FAQ): the other sites built on lila (lichess, lishogi, lidraughts and PlayStrategy), and libaduk for go.
- The site can be translated into more languages by volunteers: a language appears in the language menu once 80% of its texts are translated, and the texts still missing show in English. Piece names and the long pages (about, FAQ, terms, privacy) are translated too, and a page not translated yet shows in English. See Translations in CONTRIBUTING.md.
- Spoken moves (Settings > Preferences > Play): the browser's voice says the moves, every move or only the opponent's, in a short form ("Samurai, 6-6.") or in full sentences ("White: Samurai from 6-7 to 6-6."), and you pick where: games against people, against the computer, games you watch, puzzles, lessons and practice, and the analysis board and studies (off by default, said as you step through the moves). It replaces the move sound, follows the site's language and piece names, and stays quiet in screen reader mode.

### Changed

- Menus: Puzzles has a menu of its own (puzzles, puzzle of the day, Streak, Storm and the puzzle dashboard), and Learn keeps the rules, lessons, practice, studies and the coordinate trainer. The footer follows the menus in four columns: Play, Learn, Tools and Site.
- Settings in five sections, each on its own page: Profile (`/account`), Preferences, Privacy, Security (password, two-step verification and sessions) and Data and account. Preferences are grouped as Display, Play, Game record and Accessibility, with an index at the top.
- Profiles on other game sites show the game they are for (a chess knight, a shogi piece, a draughts man, go stones) instead of a plain link mark, and the profile form names the game beside the site.
- Game search: player, opponent, mode and result are always shown and the other filters fold under More filters (open when one is set); the results are a compact table, with previous and next pages kept in the address.
- The Tower on tap setting shows a phone with what each choice does: the balloon, the strip or only the side panel. The strip's pieces keep their size whatever the screen width.
- The language menu lists each language by its own name, in alphabetical order.
- Every page title has the same size, form labels have more room above their field, and the quick settings menu lines its values up beside the arrows.

### Fixed

- Screen readers: every screen has a main heading (hidden where the design shows none, as on the board screens), the hands beside the board are named groups, and the main menu is a named navigation. An automated accessibility check (axe) now runs on every screen in the tests.

## [0.8.0] - 2026-11-19

### Added

- On a phone held upright, tapping a tower shows every piece in it right where you look: by default in a balloon next to the square, or in a strip under the board. Settings > Board > Tower on tap picks one, or keeps only the side panel. On a computer the side panel still shows the hovered tower. It works on games, puzzles, practice, the analysis board and studies.
- Browser notifications (Settings > General, off by default): with the site open in another tab or window, the browser tells you when it is your turn, when your game starts and when a challenge arrives, and a click opens the game. Turning them on asks for the browser's permission and shows a sample. They need the site open somewhere, and browsers that only show notifications through a service worker (Chrome on Android) do not have them yet.
- Notices in the bell: it now also tells you when someone starts following you and what the moderators decided about your account or a report you sent (a report reviewed, a username changed, a profile cleared, a game voided, a study hidden, restored or deleted, a suspension lifted). Unread notices count on the badge and are marked as read when the bell closes; the moderator and the reason are never shown. They also come as browser notifications when those are on.
- 3D board (Settings > Board appearance > Board view): the board is tilted and every tower stands as tall as its pieces, with the color of each one showing on its edge, so the height of a tower reads at a glance. It works with both piece shapes and every theme, in games, puzzles, lessons, the analysis board and studies; the hands and the small boards stay seen from above. The preview in Settings shows it as soon as it is picked, now with a tower in the middle.
- Privacy on the account page: choose who may start following you (any player, only players you follow, or nobody). The followers you already have stay. A profile that does not accept you shows the Follow button disabled.
- Move confirmation (Settings > Board > Confirm move): a move made on the board waits on the board until you click Confirm (or press Enter), and Cancel (or Escape) takes it back, so a slip of the hand does not cost a game. On by default in correspondence games, and it can be set to never or always. Moves typed in screen reader mode and premoves are sent at once.

### Changed

- Correspondence games can also give 14 days per move, besides 1, 3 and 7.
- In the create a game dialog, the byo-yomi seconds are buttons, like the periods below them.
- The challenges icon in the header is now a bell, since it lists more than challenges.

### Fixed

- On touch screens, a tapped tower no longer disappears as soon as the finger lifts.

## [0.7.0] - 2026-11-17

### Added

- Game search (Tools menu, `/games`): every finished game, newest first, filtered by player, their color and opponent, mode, rated or casual, result, how it ended, average rating, dates and number of moves. The filters stay in the address, so a search can be shared, and a profile links to its player's games.
- Activity on profiles: the last 30 days, day by day, with the games played per mode (wins, draws, losses and rating change), the public studies created and the day the player joined. Your own activity also shows your puzzles, puzzle runs, lessons and practice, to you only.
- People you follow: what they played and published in the last week, on the home page (signed in) and in full on the friends page.
- Insights (`/@/<name>/insights`, linked from the rating history): a player's rated games of one mode by the opponent's strength, how the games end, pace, average length, most played opponents and, in the draft modes, the pieces placed and the results by pieces kept in hand.
- Screen reader mode, for playing and learning without seeing the board: turn it on in Settings or at the top of the sign in page. On every screen with a board (games, TV, the computer, the analysis board, studies, the board editor, lessons, puzzles, Puzzle Streak and Storm, practice, the draft explorer and the rules page's piece trainer), every move is announced in words ("White: Samurai from 6-7 to 6-6", captures, stacks, drops, betrayals, the end of the draft, check, low time, draw offers and the result), and a field takes typed moves (`6-6 samurai`, `6-7 6-6`, `ninja 4-7`, or either notation) and questions: the whole position, one square, the hands, where a piece can go, the last move, the clocks and the goal of a puzzle, lesson or practice position. `<` and `>` step through the moves, each one read with its comment and drawings in studies, whose authors can also draw by typing (`arrow 5-7 5-5 red`); the board editor takes typed pieces (`4-7 white samurai`). A board of 81 buttons can be moved through with the arrow keys. The coordinate trainer reads each square by where it stands, the rules diagrams are described in words and the rating distribution has a list. The board stays on screen for anyone helping. The FAQ, the site's structured data and llms.txt say so.

### Fixed

- The players page, profiles' game lists and bookmarks no longer pause for over a second now and then: finished games are summed up from their stored moves instead of being replayed and checked move by move.

## [0.6.0] - 2026-11-17

### Added

- Studies (Learn menu, `/study`): write chapters of moves with variations, a comment on each move and drawings on the board, and share them. A chapter starts from a mode, a position, a game of the site or an imported game. Drawings are arrows and painted squares in four colors, up to 2 arrows and 4 squares per move: right-drag or right-click on a computer, or turn on Draw with taps on a phone. The editor saves on its own. A study is public, unlisted (only with its link) or private; new accounts can publish only unlisted or private studies for their first 7 days. Studies can be reported, and moderators can hide or delete them, but never open a private one. The terms of use and the privacy policy describe it.
- Recent activity on the players page: the latest finished games, with who won, and the newest players, each with how long ago.
- Bookmarks: a star on any game page keeps it in your bookmarks, with a private note only you see. Your bookmarked games, with their notes, are a tab of your profile's games.
- Head to head: on a game between two accounts and on another player's profile, the score between the two players, the draws and their latest results, each opening its game.
- Byo-yomi clock, as in shogi and go: in Create a game (and challenges), pick Byo-yomi under Clock, then the main time (zero for byo-yomi from the first move), the seconds per move (10 to 60) and 1 to 3 periods. Once the main time runs out, every move must be made within the period; moving in time gives the whole period back, overrunning it uses one up, and the flag falls when none is left. The clock shows the period and the periods left, the time control reads `10|30s` (or `10|3×30s`), a beep warns in the last seconds of each period, and a spoken countdown in your language can be turned on in Settings. Byo-yomi games can be rated.
- Puzzle Streak and Puzzle Storm (Learn menu, and links on the puzzle pages). Streak: harder and harder puzzles with no clock, until your first wrong move, with one skip. Storm: as many puzzles as you can in 3 minutes from your first move; a wrong move costs 10 seconds, and combos of correct moves add time. Both show your best of today, of the last 7 days and ever, also on the puzzle dashboard, kept on your account or in the browser. At the end, every puzzle of the run is listed and opens on the puzzle page. Runs do not change your puzzle rating.

### Changed

- The leaderboards keep only players who played a rated game in the mode in the last 30 days (they come back with the next one, rating untouched; their profile marks the mode as inactive instead of showing a position), and show beside each rating how much it moved in the last 7 days.
- The window to create a game (also to play a friend or challenge a player) fits without scrolling: the mode, pace, clock, type and color are buttons side by side, the clock values are sliders under a summary of the time control (10+5, 10|3×30s) and a sentence that says what it means, and on phones every choice fills the width.
- The home page fits on one screen: the puzzle of the day and the strongest live game (with how many players are online and playing) moved to a column on the left of quick pairing, and the page is wider on large screens. Below the open games, a new card shows the best players of each mode. Signed in, the account and learning cards give way to your online friends and a new Train card with your puzzle rating, your Puzzle Storm and Streak records and how far you are in the lessons.
- The menu under your name (or the gear without an account) changes the board and the pieces right there, as on lichess: Board picks the board theme and Pieces the shape, what each piece shows and its colors, each with a color sample, plus a link to the other options in Settings. Its first link now reads Profile instead of repeating your name.

### Fixed

- The tabs of a profile's games (all, rated, wins, losses, draws) now count only the games the mode, color and opponent filters leave, instead of every game.

## [0.5.0] - 2026-11-16

### Added

- Lessons (Learn > Lessons): learn Gungi by playing, in eight stages of short exercises on the board: the pieces, towers, pieces in hand, the jumping pieces, betrayal, the Marshal in danger, mate and the draft. Each exercise has a goal and a hint, and earns up to three stars by the number of moves (in mates, by the wrong tries). The map shows the stars of every stage and returns to the first exercise not yet mastered. Progress is kept on your account, or in the browser without one, and moves to the account when you sign in. The rules page links to them.
- Coordinate trainer (Learn > Coordinate trainer): find the square whose name is shown, or name the square that lights up, as many as you can in 30 seconds, in the rulebook's notation (5-3) or the machine one (e3), from either side and with or without the edge labels. Best scores stay in the browser.
- Practice (Learn > Practice): positions to play out against the computer at its strongest, each with a goal and a move limit: mate the lone Marshal in endgames, convert an extra piece into a win, or hold on under attack. Finished positions are marked with the fewest moves they took, on your account or in the browser.
- Play the computer from any position: a button in the board editor and in the analysis starts a game against the computer, at the level you choose, from the position on the board.
- Puzzles (Learn > Puzzles): mates in 1, 2 or 3 moves, with the tsume convention of shogi (every one of your moves must attack the Marshal), and material wins, where one move stands out. Each player has a puzzle rating and each puzzle its own: your first try at a puzzle moves both, and the next puzzle is chosen near your rating. Pick a theme (mate in N, win material, capture, piece in hand, stacking, betrayal) and a mode, solve the puzzle of the day, also shown on the home page, and follow your rating, your results by theme and your latest tries on the puzzle dashboard. In mates any other mating move is accepted and the computer answers with the longest defense; a wrong move is taken back. Without an account, solved puzzles are kept in the browser and move to the account when you sign in.
- Draft explorer (Tools > Draft explorer): what players place in the draft of the intermediate and advanced modes, in which order and with what results, from the games finished on the site. Each placement shows how many games played it, White wins, draws and Black wins, and the average rating; pick one in the table or on the board to see what came next, and step back along the path. Filter by rating range and rated games only.

### Fixed

- TV channels and a mode's ranking showed the site's generic title in the browser tab; they now carry the TV and ranking titles.

### Security

- Node 24.22.3, a security release, in the server image and as the minimum version to develop the project.

## [0.4.0] - 2026-11-14

### Added

- TV channels: one for the strongest game on the site and one per mode, each following its game live on a full board (clocks, moves and the move list) and moving on to the next a few seconds after it ends. The channels sit beside the board with who is playing on each; the grid of every live game is still on the TV page, with a button to its channel.
- Profile details, on the Account page: a bio (up to 400 characters), your country, shown as a flag beside your name on the profile, the ranking and the players page, and your profiles on social networks (YouTube, Twitch, Instagram, X, TikTok, Bluesky, Reddit, GitHub) and on other game sites (lichess, lishogi, lidraughts, libaduk). You type only your username and the site builds the address, so links can only lead to those sites. Moderators can clear a bio and its links, and the "offensive name" report reason now covers the profile too.
- Import a game (Tools > Import a game, or the button in the analysis): paste or upload a game exported from ligungi, or type the moves in rulebook or machine notation, and it opens in the analysis. Every move is checked against the rules, and a wrong or ambiguous one is reported with its line. Imported games never touch ratings.
- Board editor (Tools > Board editor): place and stack pieces of both sides, fill the hands, pick the mode and who moves, starting from the Marshals alone or from a mode's starting position. The position is checked against the rules as you edit (one Marshal per side, nothing on a Marshal, piece counts, tower heights, no side left in check out of turn), and a valid one opens in the analysis or is shared as FEN or link.
- Rating history on profiles: a chart of the rating after each rated game, one mode at a time (the most played first), with the current rating, the peak and the lowest with their dates, and the results by color and by game length. Hover or touch the chart for each game's rating and change; the points are also listed as a table.
- Moderation: report a player from their profile or a game (cheating, offensive name or profile, behavior or other), and moderators handle the reports on their own page. They can suspend an account for a while or for good (its sessions end, its games in progress are lost and signing in shows until when and why), rename an offensive username everywhere, and void a game won by cheating, giving the opponent their rating points back. Every action is logged with its reason. The terms of use and the privacy policy describe it.
- New piece looks in Preferences, to combine freely: the shape (the disc, or a wooden koma pointing at the opponent, as in shogi), what each piece shows (icon, the icon as an outline, kanji or two letters of its name in the chosen language), the kanji typeface (the device's own, or brush, serif, gothic and pop typefaces that come with the site and look the same everywhere) and the colors (lacquer, indigo, jade and bronze for the disc; light and dark wood, cherry and ebony, bamboo and walnut, and lacquer for the koma; or your own colors, with a warning when the symbol loses contrast or the sides look alike).
- Hidden pieces, a memory training in Preferences: the board shows only the color of each piece, while the hands still show them. Applies to casual games, the computer and analysis, with an option to peek by hovering a square.
- Custom board theme in Preferences: pick the board and line colors, with the preview following along. The move marks (last move, selection, destinations and reach) switch on their own to the built-in colors that stand out most on that board, and a note warns when lines, pieces or marks would be hard to see. Saved in the browser.
- Two-step verification, opt-in, in the Account page: scan a QR code with any authenticator app (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS and others), confirm with a first code (and, if you wish, sign out every other device), and signing in then asks for the 6-digit code after the password. Ten single-use recovery codes, to copy or download, let you in if you lose your phone; you can make new ones or turn the verification off with your password and a code.

### Changed

- The live games on the home page and on the TV page follow every move as it is played, with both clocks running, instead of showing a position loaded once (home) or refreshed every 5 seconds (TV). On phones the home page lists them as scoreboards, each side with its clock.
- White always moves first, in every mode, as in chess. The physical game draws who starts, but Gungi is symmetric, so the draw now picks the colors instead: creating a game, a challenge or a game against the computer asks only for your color. Older games where Black started still open and replay as before.
- The site runs on Preact 11 (from 10), with the same look and behavior on every page.
- Move lists keep each move on one line: with piece names, the longest ones are abbreviated (Ten.-Gen., Maj. Gen., Mosq.) and the full move shows on hover, and the capture and betrayal marks come before the name (`5-3-1 ×Samurai`). The analysis move list uses the site's font, like the game's.

### Fixed

- After reloading a page (F5), your own account showed as offline on the players page, your profile and the ranking, and was left out of the online counts, until the page refreshed again.

## [0.3.0] - 2026-11-14

### Added

- Correspondence games: challenge a player from their profile or by link, or open a game in the lobby's Correspondence tab, with 1, 3 or 7 days per move, rated or casual, and play without being online at the same time. Whoever runs out of days loses (a game nobody started is aborted), being away never does. The bell in the header counts the games waiting for your move and lists them, with a sound when a move arrives, and your games on the home page say whose turn it is and how long is left. They stay off the TV and the live counts, so their players remain free to challenge. Their challenges and open games wait up to 7 days, even with you away, and survive server restarts. Needs an account.
- Takebacks in casual games: ask to take back your last move, and the opponent accepts or declines. Not available in rated games or for the first two moves.
- Give your opponent 15 seconds with the + button on their clock, in any game with a clock.
- Players page (Community > Players), made to find someone to play: how many are online and free, quick game and create game buttons, and the list of signed-in players online with their rating and leaderboard position in the chosen mode, whether they are free or playing, and a Challenge or Watch button. Filters for free players, people you follow and a name search. On the side, the site's numbers and a rating distribution chart that marks where you stand.
- Two stronger computer levels: level 4 thinks up to about 1 second per move and level 5 up to 3 seconds, searching several moves ahead, following captures to the end and avoiding repeating positions when ahead. Levels 1 to 3 are unchanged.
- When you offer a draw or a takeback, a line says it is waiting for your opponent, and another tells you if they decline (also for rematches).

### Changed

- Profile redesigned: a header card with the player's initial, status, follow counts and the Challenge and Follow buttons; one card per mode with rating, leaderboard position and a wins, draws and losses bar; the live game in its own strip; and the game history as rows showing the result, the opponent, how the game ended, the rating change and the date, with mode chips and tabs above. On phones the cards sit two by two and the tabs scroll sideways.
- The first player mark beside a name is now "1st" instead of the kanji 先, and the done button in the draft shows only "Done".
- In games, the rating sits right after the player's name on wide screens too, instead of at the far end of the row.
- About, FAQ, contact and legal pages redesigned: a menu between them beside the article (a row of chips on phones) and each FAQ question opening on its own.
- Sign in and sign up redesigned: what an account gives beside a card with Sign in and Sign up tabs, the username rule under the field when signing up, and the reminder that the password cannot be recovered. On phones the form comes first.
- Preferences and Account redesigned: a menu between the two beside the page (tabs on phones) and each group in its own card. In Preferences the choices are switches of options and the board theme is a row of cards, with the previews beside them. In Account, changing the password sits next to the challenge setting and the data download, then the connected devices and, apart, deleting the account.
- Challenge page redesigned: one card that says whether the challenge is for you, by link or to someone; who challenges you with their rating; the mode, time, rated or casual, your colour and who starts as tiles from your side of the board; and Accept and Decline side by side, or the link to copy while you wait.
- Learn page redesigned: a table of contents that follows your reading (chips on phones) beside the sections, each in its own card; the 14 pieces as a grid where picking one loads it in the trainer (the Marshal included), with arrows to go to the previous or next piece and, under the controls, its note and its reach at each tower level; and a new section with the game modes.
- Friends page redesigned, with the community tabs: how many you follow and how many are online, an online-first order, a name search, and per player the status, the rating in every mode and a Challenge (when they accept challenges from you) or Watch button. On phones each row shows the status and the rating of a mode you pick.
- TV redesigned: the strongest game (highest combined rating) is shown large, the others in a grid, each with both players, their ratings and running clocks, and a line with the mode, time control, rated or casual and the move number; a filter by mode and the number of games live next to the title. On phones the smaller games show two per row.
- Play against the computer redesigned: the five levels are cards with a short name (Random, Greedy, Careful, Strong, Strongest) and what each one does; the mode is a switch with its description; your colour and who starts are cards too. On phones the levels stack as rows. During the game the side card shows the level by its short name.
- Game page redesigned: each player row shows an initial in the colour of their pieces, name, rating and whether it is their turn or they are online, with the clock in the same row; the hands sit above and below that card, which stays centred beside the board; the takeback, draw, resign and abort buttons have a label under the icon; and the side card is shorter (mode, time, rated or casual, export). On phones the opponent's row comes first, the hands sit right by the board, and the move navigation buttons are back under the move list.
- Home page redesigned: quick pairing first, with a mode picker (remembered on this device) and, on each time control, how many players are already waiting for it; the create, friend and computer buttons beside it; open games as rows with a Join button; two live games from the TV; and a strip with your own games in progress. The leaderboard box left the home page (the full leaderboard has its own page).
- Leaderboard redesigned: the modes on the side with your rating and position in each, and the full leaderboard of the chosen mode in pages of 50, with wins, draws and losses, who is online, a name search, a filter for the people you follow and a button to jump to your own position. On phones the modes become cards and your position stays at the bottom of the screen.

### Fixed

- Rules: capturing the opponent's Marshal is now always allowed, even when your own Marshal is still attacked afterwards. Right after the draft both Marshals can be under attack, and the capture used to be hidden, which could even end the game as a mate for the player who had the winning move.
- Rules: with only the two Marshals left, the game is no longer a draw when they stand next to each other, because the player to move captures and wins.
- The site header got no background when the page was scrolled, so the content showed through it.
- The piece trainer on the learn page showed two empty grey bars under the board.
- Secondary buttons no longer look see-through on hover in the light theme: they get a tinted background and an outline in both themes.
- The draw confirmation (Offer a draw?) had its buttons out of place, and the answer buttons to an offer did not look like the rest of the game controls.

## [0.2.0] - 2026-11-13

### Added

- Movement indicators: marks around each piece show how it moves (a dot for each square of reach, an arrow for an unlimited line, a ring where jumping pieces land). On by default for new visitors; Preferences has the switch.
- Illustrated piece style: an icon for each piece (crown, rank stars, katana, spear, horse, shuriken, castle, jingasa, cannon, bow, musket, compass), the default for new visitors; players who saved preferences before keep the kanji. The kanji style stays in Preferences, under Piece style, with a live preview. In the illustrated style the piece panel shows the icon, the name and the kanji together, and the opponent's icons stay upright.
- Move notation choice in Preferences: the rulebook's (`3-2-2 槍新`), the same with the piece name (`3-2-2 +Lancer`, with `+` for a piece from the hand, `×` capture and `⇄` betrayal; the default for new visitors) or the machine notation used in exports, which also switches the board coordinates to letters and numbers (`a1` to `i9`).
- Challenge a player from their profile: the Challenge button opens the usual game settings and the player gets the challenge right away in a new challenges menu in the header (with a sound), where they can accept or decline. The challenge is withdrawn if you leave the site. The Account page sets who may challenge you: anyone, only players you follow, or nobody.
- Board themes in Preferences: light wood, dark wood, gray and high contrast. High contrast uses blue and yellow for the move marks, easier to tell apart with color blindness or low vision. The theme also applies to the small boards (TV, learn page) and the tower panel.
- A "New to Gungi?" box beside the board in your first games, to switch the illustrated pieces, the movement indicators and the reach on hover, with a link to the rules.

### Changed

- Preferences page redesigned: settings grouped (General, Board appearance, Game record, Board), each with a short explanation and switches for on/off options. The board appearance settings (theme, piece style, movement indicators, coordinates) show a corner of the board and the record settings a sample move list, both updating as you change them. Board size links to the board to see it.
- Showing a piece's reach on hover is now on by default for new visitors.
- The privacy policy now mentions the challenge setting kept with the account, and the data download includes it.
- Profile header reorganized: Follow and Challenge beside the name, and member since and follow counts on one line below with the head-to-head link.

### Fixed

- Pages with a side menu (profile, account, ranking, friends, TV, info pages) kept changing width with their content, for example when switching the profile tabs.
- Challenge links older than 2 hours could still be accepted, or not, depending on whether someone else had created a challenge in the meantime. They now always expire after 2 hours, and the page says the challenge was canceled.
- In games and analysis, White's pieces in hand (beside the board) had no disc color and looked black on the dark theme.
- Board coordinates could disappear where they overlapped a piece of the same shade; they now have a halo in the board color.
- The red glow on a Marshal in check was hidden almost entirely under the piece; it now shows around it.
- On phones, the ratings at the top of a profile showed only the numbers, without the mode names, above a tall empty band.

## [0.1.4] - 2026-11-13

### Added

- Account page: see the devices where your account is signed in and sign out one or all of the others.
- Account page: download a copy of your data (profile, ratings, follows, sessions and all your games) as JSON.

### Changed

- New site footer, the same on every page including the home: the brand, links grouped into Site, Play and Code and legal, and the legal notice with the version.
- Build tooling upgraded to Vite 8 and TypeScript 7, and the server image to Node 24.22.2.
- The privacy policy now says that each signed-in session keeps the browser's description and its sign-in and last-use dates, and lists what you can do yourself on the Account page.

## [0.1.3] - 2026-11-13

### Added

- Search engines, AI assistants and link previews now see the real content: public pages are prerendered in Portuguese, English and Spanish, each with its own title, description, canonical address, language alternates (`?lang=`), Open Graph image and structured data.
- `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` (the full rules specification).
- The site can be installed as an app (web manifest and icons).
- While your game waits in the lobby, the home shows it with a cancel button instead of the quick pairing grid.
- Link to the public status page in the footer and on the home.

### Changed

- Cancelling your game in the lobby asks for confirmation.
- `?lang=pt`, `?lang=en` or `?lang=es` in the address sets the language for the tab.

## [0.1.2] - 2026-11-12

### Added

- Account page (from the user menu or the settings page): change the password, which signs out the other devices, and delete the account. Finished games stay in the history as "Anonymous".
- Player search in the header.
- `GET /api/health` for uptime monitoring.

### Changed

- Empty required form fields are no longer outlined in red before the user types in them.

### Fixed

- Icons of the analysis board controls were drawn below the center of their buttons.

### Security

- Test tooling upgraded to vitest 5.1.0, clearing the advisories in vitest, tinypool and @vitest/mocker (development only; production dependencies were not affected).

## [0.1.1] - 2026-11-12

### Added

- About, FAQ, contact, terms of service and privacy policy pages, in the three languages, linked from the home and the footer.
- Rule sources on the learn page.
- Leaderboard and featured game boxes on the home page.
- Optional Cloudflare Web Analytics (no cookies), loaded only after the visitor accepts it in a cookie notice; the choice can be changed on the privacy page.

### Changed

- Home counters stacked under the game buttons, and ligungi's logo faded behind the quick game grid, as on lichess.
- Pages are sent with `Cache-Control: no-transform`, so a CDN cannot inject scripts (such as analytics) before the visitor consents.

## [0.1.0] - 2026-11-12

First public version.

### Added

- Rules engine for the official 2022 Gungi rules (all four modes, draft, towers, drops, betrayal), with the specification in `docs/rules.md`.
- Online play in real time: lobby with automatic pairing, challenge links, clocks with increment, draw offers, rematch, abort and victory claims.
- Optional accounts with Glicko-2 ratings per mode, leaderboards, following players and profiles with a filterable game history.
- Play against the computer, analysis board, live games and a rules page with an interactive piece trainer.
- Interface in Portuguese, English and Spanish.
- Lichess-based look (lila's styles), shared form components and a design system page at `/design`.

[Unreleased]: https://github.com/beater-studios/ligungi/compare/v0.9.2...HEAD
[0.9.2]: https://github.com/beater-studios/ligungi/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/beater-studios/ligungi/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/beater-studios/ligungi/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/beater-studios/ligungi/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/beater-studios/ligungi/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/beater-studios/ligungi/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/beater-studios/ligungi/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/beater-studios/ligungi/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/beater-studios/ligungi/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/beater-studios/ligungi/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/beater-studios/ligungi/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/beater-studios/ligungi/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/beater-studios/ligungi/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/beater-studios/ligungi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/beater-studios/ligungi/releases/tag/v0.1.0

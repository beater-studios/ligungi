# Roadmap

Work the maintainer has confirmed. Candidates and ideas live in [backlog.md](backlog.md); an item moves here only once it is confirmed, and leaves this file (for the changelog) once it ships.

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more).

| Item | Why | Size | Notes |
|---|---|---|---|
| Custom board theme | The four built-in themes (light wood, dark wood, gray, high contrast) shipped; some players want their own colors | S | Pick the board and line colors in Preferences, kept in the browser. Warn or adjust when the marks (last move, selection, destinations, reach) would not stand out against the chosen colors. |
| Two-factor authentication (TOTP), opt-in | Protects accounts, especially valuable ones (moderators, top players) | M | Off by default: only players who turn it on in the Account page get the extra step. Setup shows a QR code for any authenticator app and asks for a first code. Login asks for the 6-digit code after the password. About 10 single-use recovery codes are mandatory, since the site sends no email and a lost phone would otherwise lock the account. TOTP uses Node's crypto, no new dependency. |
| Byo-yomi time control (for example 10 min + 30 s), with an optional spoken countdown | The traditional clock of Japanese games: once the main time runs out, every move has a fixed period | M | New time control type in game creation, the server clock and the clock display; optionally several periods (3 x 30 s). The draft keeps its own clock rule. |
| Correspondence games (1, 3 or 7 days per move) | Play without being online at the same time, which suits a young site with few players online | M | Games persist without a live connection, with a clock in days and a "your turn" list on the home. Needs a way to tell players it is their turn: in-site notices (see the notification bell in the backlog) and optionally browser notifications. Pairs with challenges from the profile. |
| Stronger computer opponent | The bot looks 2 plies ahead; average players beat it easily. Computer analysis, learn from your mistakes and regular puzzles all depend on it | M | Deeper search (alpha-beta with move ordering, 4 to 6 plies), a better evaluation (material, tower heights, Marshal safety, mobility, pieces in hand) and a time budget per move, still in the Web Worker. A truly strong engine is a larger project. |
| Players page: who is online, live games, site statistics and rating distribution | Shows the site is alive and helps find opponents | M | Online players with ratings, live games, games today and totals, a rating distribution chart per mode ("you are here") and the top players of each mode. The data already exists; counts must stay cheap. |

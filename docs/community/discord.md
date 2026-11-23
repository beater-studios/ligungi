# Discord server

The record of the ligungi Discord server: its structure, settings and the texts the bot posted. The server is managed through the `discord-ligungi` MCP (the bot `ligungi`, application `1573429066755739949`, with Administrator). Any change made on Discord, by hand or through the bot, is written here in the same change, so the server can be rebuilt from this file.

- Server: `ligungi`, id `1573431103035940956`
- Permanent invite: https://discord.gg/RgtNN7yXU5 (to #welcome, never expires, no use limit)
- Created: 2026-11-20
- Short addresses to share: https://ligungi.org/discord (a temporary redirect by the server, `SHORT_LINKS` in `packages/protocol/src/links.ts`) and https://discord.ligungi.org (a Cloudflare redirect rule straight to the invite, set by `deploy/cloudflare.py redirects`, which reads `DISCORD_INVITE` from the code). Both go to the invite in one step; neither redirects to the other.
- The invite lives in `DISCORD_INVITE` (`packages/protocol/src/links.ts`), used only by the server redirect; the site (footer, contact page, FAQ, account page) and the repository documents link to `discord.ligungi.org` (`DISCORD_LINK`), so links already copied keep working. A new invite means changing it there, deploying, running `deploy/cloudflare.py redirects` again, and updating the AutoMod allow list of the invites rule.

## Settings

| Setting | Value |
|---|---|
| Community mode | on |
| Verification level | medium (verified email and an account older than 5 minutes) |
| Explicit content filter | all members |
| Two-factor requirement for moderation | on (set by hand on 2026-11-21): moderators, and the owner of any bot that moderates, need 2FA on their account |
| Pruning members | restricted to administrators (set by hand on 2026-11-21) |
| Default notifications | only mentions |
| Preferred locale | en-US |
| Rules channel | #rules |
| Community updates and safety alerts | #mod-log |
| System messages | #mod-chat (moved there by a settings screen on 2026-11-21 and kept by the maintainer: joins stay among moderators for now): join and boost notices and setup tips on, the sticker reply button off |
| Description | The community of ligungi.org, the free and open source site to play Gungi online with the official 2022 rules. Games, strategy, puzzles, help and feedback, in English, Portuguese and Spanish. |

Server page (Server Settings, set by hand since the API does not cover it):

- Category: Gaming, with the closest subcategories offered (board or strategy games, anime and manga, open source or programming).
- Reasons to join: 🎯 Find opponents and share your Gungi games; 🌱 Learn the official rules with friendly help; 🧩 Talk strategy, drafts and puzzles; 🛠️ Help shape an open source site.
- About: The home of ligungi.org, the free and open source site to play Gungi, the strategy board game from HUNTER×HUNTER, with the official 2022 rules. Find opponents, talk strategy and drafts, solve puzzles, get help with the rules and help shape the site. English, Portuguese and Spanish welcome.
- Social links: https://ligungi.org and https://github.com/beater-studios/ligungi.
- Server Home: banner `discord/home-banner-1920x1080.png` from `/media` (source `apps/web/brand/discord-home-banner.svg`), the 14 pieces in a row on a strip of board, with no text since Discord draws the name and icon over it. The games leaderboard and popular games widgets removed (Discord does not detect ligungi as a game, so they would show other games), and a text and image widget titled "Welcome to ligungi", with `igdb/screenshot-3-puzzle.png` and this text: "Play Gungi, the strategy board game from HUNTER×HUNTER, with the official 2022 rules at ligungi.org: free, no ads, no account needed. New to Gungi? Start with the lessons at ligungi.org/lessons and ask anything in #help. Already playing? Share your games in #share-games and talk drafts in #strategy. Want to help? Ideas and bugs go in #feedback, code and translations in #development and #translations."
- Server Home, more text and image widgets (images from `/media/igdb`): "How Gungi works" (left, below the welcome; `screenshot-6-piece-movement.png`): "Gungi is played on a 9×9 board, a bit like shogi, but pieces stack into towers of up to three, and the higher a piece stands, the farther it reaches. In the full game both players build their army in an open draft, placing pieces one at a time, and pieces kept in hand can be dropped later. Leave the enemy Marshal with no way out to win. Four modes take you from a fixed setup with the basic pieces to the full game." "Play on ligungi.org" (right, top; `screenshot-9-computer.png`): "Play the computer at five levels, or people in rated and casual games, live or by correspondence. Send a challenge link to a friend. Solve the daily puzzle, Puzzle Streak and Puzzle Storm. Learn with lessons, then dig deeper with studies, the analysis board and the draft explorer. In English, Portuguese and Spanish, on desktop and mobile, at ligungi.org." "Help build ligungi" (right, below; `icon-512.png`): "ligungi is free and open source (AGPL), built in the open at github.com/beater-studios/ligungi. You can help without writing code: report bugs and ideas in #feedback, translate the site into your language in #translations, or work on the rules and the engine in #development. Pick "Help build ligungi" in Channels & Roles to see those channels."
- Discovery cover (1920×1080): `igdb/keyart-logo-1920x1080.png` from `/media`, the key art with the logo (source `apps/web/brand/keyart-logo.svg`), since the server's name alone does not say it is about Gungi.

## Roles

From the top. The bot role `ligungi` (managed, Administrator) must stay above every other role, or the bot cannot manage them. New roles are created tied at position 1, and while they tie the bot cannot place them; a reorder of roles already in place (say, Updates to 2 and Events to 1) makes Discord renumber them all, and then the bot can move the new ones.

| Position | Role | Id | Color | Shown apart | Permissions | Who |
|---|---|---|---|---|---|---|
| 23 | ligungi (bot) | `1573431786871197726` | none | no | Administrator | the bot |
| 22 | Moderator | `1573434311749796002` | `#d8443f` | yes | manage messages and threads, timeout, kick, ban, nicknames, audit log, voice moderation, events, pin, mention everyone | moderators (the maintainer) |
| 21 | Contributor | `1573434313847087237` | `#d9a441` | yes | none | people who contributed code, rules or translations |
| 20 | 大 General | `1574465452812406926` | `#b57edc` | yes | none | rank: best established rating 2000 or more (the bot) |
| 19 | 中 Lieutenant General | `1574465454775476295` | `#4aa3df` | yes | none | rank: 1800 to 1999 (the bot) |
| 18 | 小 Major General | `1574465456419639367` | `#3fb4a2` | yes | none | rank: 1650 to 1799 (the bot) |
| 17 | 侍 Samurai | `1574465458730434640` | `#8bc34a` | yes | none | rank: 1500 to 1649 (the bot) |
| 16 | 兵 Soldier | `1574465460299235369` | `#c27c4e` | yes | none | rank: below 1500 (the bot) |
| 15 | Verified player | `1574465463218471055` | `#7d8590` | yes | none | linked account (Discord's Linked Roles) |
| 14 | 🇺🇸 EN | `1573434315784851621` | none | no | none | chosen in onboarding (language) |
| 13 | 🇧🇷 BR | `1573434318204964874` | none | no | none | chosen in onboarding (language) |
| 12 | 🇪🇸 ES | `1573434319702204457` | none | no | none | chosen in onboarding (language) |
| 11 | 🌱 New player | `1573845872842776667` | none | no | none | chosen in onboarding (mode played most) |
| 10 | 🟢 Beginner | `1573845874562310195` | none | no | none | chosen in onboarding (mode played most) |
| 9 | 🟡 Intermediate | `1573845887011127396` | none | no | none | chosen in onboarding (mode played most) |
| 8 | 🔴 Advanced | `1573845888999231488` | none | no | none | chosen in onboarding (mode played most) |
| 7 | 🧩 Puzzles | `1573845891335590023` | none | no | none | chosen in onboarding (what they enjoy) |
| 6 | ⚔️ Tournaments | `1573845893134680064` | none | no | none | chosen in onboarding (what they enjoy); a profile, never pinged (pings go to Events) |
| 5 | ✉️ Correspondence | `1573845894699290676` | none | no | none | chosen in onboarding (what they enjoy) |
| 4 | 📖 Study | `1573845896624340993` | none | no | none | chosen in onboarding (what they enjoy) |
| 3 | 🛠️ Builder | `1573845898495262760` | none | no | none | chosen in onboarding (what they enjoy): wants to help build the site |
| 2 | 📢 Updates | `1573434321446903969` | `#3692e7` | no | none | opt in: pinged for new versions |
| 1 | 🏆 Events | `1573434322986213519` | `#629924` | no | none | opt in: pinged for events and tournaments |

### Ranks and Linked Roles

Players who link their ligungi account (Account > Profile, or the Linked Roles menu of the server) get one rank role, given and moved by the bot from their best established rating across the modes (`DISCORD_TIERS` in `packages/protocol/src/discord.ts`, synced by `apps/server/src/discord.ts`). The ranks are shown apart, below Contributor, highest first; a provisional rating gives only Verified player.

| Role | Rating | Given by |
|---|---|---|
| 大 General | 2000 or more | the bot (`DISCORD_ROLE_GENERAL`) |
| 中 Lieutenant General | 1800 to 1999 | the bot (`DISCORD_ROLE_LIEUTENANT_GENERAL`) |
| 小 Major General | 1650 to 1799 | the bot (`DISCORD_ROLE_MAJOR_GENERAL`) |
| 侍 Samurai | 1500 to 1649 | the bot (`DISCORD_ROLE_SAMURAI`) |
| 兵 Soldier | below 1500 | the bot (`DISCORD_ROLE_SOLDIER`) |
| Verified player | linked account (Links tab: ligungi) | Discord's Linked Roles |

The six roles exist (ids in the roles table above) and the Linked Roles fields are registered (`node src/cli.ts discord metadata`, run again only if `DISCORD_METADATA` changes). Verified player's Links tab has ligungi with no extra requirement, so any linked account qualifies (a provisional rating is sent as 0, so a rating requirement would leave those players out). The "Ranks" message in #rules (`1574473933816729613`, an embed below the rules) explains each rank and how to link.

No role but Moderator can be mentioned by members: the profile roles are not mentionable, so no one pings a whole mode or interest. A "Looking for a game" opt-in role can come later if players ask.

@everyone keeps Discord's defaults except mention @everyone, create events and create expressions (emojis, stickers, sounds), which are removed. Announcements ping the Updates or Events role, never @everyone.

## Channels

| Category | Channel | Id | Type | Permissions | Topic |
|---|---|---|---|---|---|
| START HERE (`1573434421108019271`) | | | category | @everyone cannot send messages, create threads or polls | |
| | #welcome | `1573434476493799495` | text | read only | What ligungi is and how to start. ligungi.org |
| | #rules | `1573434479207518320` | text | read only | The server rules. Read them before posting. |
| | #announcements | `1573434570010005585` | announcement | read only | New versions and news about ligungi.org. Get the Updates role to be notified. |
| COMMUNITY (`1573434423079080056`) | | | category | open | |
| | #general | `1573434571884855396` | text | open | General chat about Gungi and ligungi, in English. Português em #português, español en #español. |
| | #português | `1573434573692604499` | text | open | Conversa sobre Gungi e o ligungi em português. |
| | #español | `1573434575064010793` | text | open | Charla sobre el Gungi y ligungi en español. |
| | #strategy | `1573434577047785573` | text | open | Positions, drafts, towers and how to play better. Share a position with its FEN or a link to the analysis board. |
| | #share-games | `1573434579627286558` | text | open | Links to your games, studies and puzzles on ligungi.org. Never ask for help in a game still being played. |
| | #off-topic | `1573434581154271317` | text | open | Anything else. Keep the rules, and mark HUNTER×HUNTER spoilers as spoilers. |
| VOICE (`1573852601680666777`) | | | category | open | |
| | 🇺🇸 Lounge | `1573852633356308722` | voice | open | voice chat in English |
| | 🇧🇷 Bate-papo | `1573852635176501348` | voice | open | voice chat in Portuguese |
| | 🇪🇸 Charla | `1573852637198291057` | voice | open | voice chat in Spanish |
| | Play together 1 | `1573434583360213042` | voice | open | play and watch games together (was "Play together" in COMMUNITY) |
| | Play together 2 | `1573852642839625878` | voice | open | a second table, for two games at once |
| PROJECT (`1573434424828362832`) | | | category | open | |
| | #help | `1573434622828744747` | forum, tag required | open | Questions about the rules, the site or your account. One post per question, with a tag. Rules: ligungi.org/learn. FAQ: ligungi.org/faq. |
| | #feedback | `1573434628264558662` | forum, tag required | open | Suggestions and bug reports, one per post, with a tag. For a bug, say what you did, what you expected and what happened, with a link to the game if there is one. Confirmed items go to GitHub issues. Security problems go privately through the contact page, never here. |
| | #translations | `1573434629732442205` | text | open | For volunteers translating ligungi. How to translate: Translations in CONTRIBUTING.md on GitHub. |
| | #development | `1573434631179735093` | text | open | Code, rules engine and contributing to ligungi (AGPL, on GitHub). Start with CONTRIBUTING.md. |
| STAFF (`1573434426476462150`) | | | category | hidden from @everyone; Moderator can view, send and read history | |
| | #mod-chat | `1573434482227155135` | text | moderators only | Moderators only. |
| | #mod-log | `1573434485050056734` | text | moderators only | AutoMod alerts and Discord notices. Moderators only. |
| | #mod-previews | `1573835004432224336` | text | moderators only | Drafts of bot posts (announcements and other public messages), shown here exactly as they will be posted. Nothing is posted publicly before a moderator approves it here. Moderators only. |

Forum tags (tags marked moderated can only be set by moderators):

- #help: 📖 `rules`, 🌐 `site`, 👤 `account`, ✅ `solved` (moderated), 📌 `guide` (moderated, for the pinned guide post)
- #feedback: 💡 `suggestion`, 🐛 `bug`, 🌍 `translation`, ♿ `accessibility`, 🔗 `on GitHub` (moderated), ✅ `done` (moderated), 📌 `guide` (moderated, for the pinned guide post)

Both forums have 👍 as the default reaction: the vote for an idea or bug in #feedback, "same question" or "this helped" in #help.

## AutoMod

All rules block the message and alert #mod-log.

| Rule | Id | Trigger | Details | Exempt |
|---|---|---|---|---|
| Slurs and sexual content | `1573434760238202983` | Discord's lists | slurs, sexual content | #mod-chat, #mod-log |
| Mention spam | `1573434762360791172` | mentions | more than 5 unique mentions, raid protection, 10 minute timeout | Moderator |
| Invites to other servers | `1573435056838545549` | regex `(?i)(discord\.gg\|discord(app)?\.com/invite\|dsc\.gg)/[a-z0-9-]+` | allowed: `discord.gg/RgtNN7yXU5`, `discord.com/invite/RgtNN7yXU5` | Moderator |
| Spam | `1573434766143782942` | Discord's spam detection | | Moderator |

## Onboarding and welcome screen

Onboarding is on (advanced mode, set by Discord once the questions show channels). Default channels: #welcome, #rules, #announcements, #general, #strategy, #share-games, #off-topic, #help, #feedback, 🇺🇸 Lounge, Play together 1 and Play together 2. #português and 🇧🇷 Bate-papo, #español and 🇪🇸 Charla, #translations and #development are shown by the answers below, and anyone can still find them in Browse Channels. Questions, all optional:

1. "Which languages do you speak?" (multiple choice): 🇺🇸 English (Chat in #general), 🇧🇷 Português (Conversa em #português, shows #português and 🇧🇷 Bate-papo), 🇪🇸 Español (Charla en #español, shows #español and 🇪🇸 Charla), each giving its language role.
2. "Which mode do you play most?" (single choice): 🌱 New to Gungi (Still learning the rules), 🟢 Beginner (Fixed setup, towers of two), 🟡 Intermediate (Draft, towers of two), 🔴 Advanced (Draft, towers of three: the full game), each giving its role. It asks about the mode, as on the site, not about strength; the Intro mode is left out.
3. "What do you enjoy?" (multiple choice): 🧩 Puzzles (Daily puzzle, Puzzle Streak and Puzzle Storm), ⚔️ Tournaments (Competing in arenas and events), ✉️ Correspondence (Games over days, a move at a time), 📖 Study and analysis (Studies, the analysis board and the draft explorer), 🛠️ Help build ligungi (Code, rules and translations; shows #development and #translations), each giving its role.
4. "What would you like to hear about?" (multiple choice): 📢 Site updates (A ping when a new version of ligungi.org comes out) gives Updates; 🏆 Events (A ping for tournaments and community events) gives Events.

Rules in Server Settings > Access (shown when someone opens an invite, set by hand since the API does not cover it), the short form of #rules:

1. Be respectful. Disagree about moves, not about people.
2. No hate, harassment or threats, and no slurs or discrimination of any kind.
3. Fair play: never ask for or give help in a game still being played, and never use engines or outside help in games against people.
4. No spam or self-promotion. Share your ligungi games, studies and puzzles in #share-games; other servers, sites and products need a moderator's OK first.
5. Keep it suitable for all ages: no adult, gory or shocking content in messages, names or avatars.
6. Mark HUNTER×HUNTER spoilers as spoilers.
7. English in #general and the other channels, Portuguese in #português, Spanish in #español.
8. Follow Discord's Terms of Service and Community Guidelines. Moderators decide what fits these rules; to contest a decision, message a moderator privately.

Welcome screen description: "Play Gungi online at ligungi.org, with the official rules. Talk strategy, share your games and help shape the site." Channels: #rules (Read the rules first), #general (Say hello), #help (Ask about the rules or the site), #share-games (Share your games), #announcements (News and new versions).

## Emojis

26 static emojis (128×128 PNG), out of the 50 static ones a server without boosts may have. Sources in `apps/web/brand/emoji` (see its README); the pieces are the white face of the site's default set, and the move annotations use lila's analysis colors. Uploaded with the MCP's `create_emoji`, available to everyone.

| Emoji | Id | What |
|---|---|---|
| `:ligungi:` | `1573838785505001502` | the site's icon |
| `:marshal:` | `1573838793990209626` | 帥 |
| `:general:` | `1573838796468916324` | 大 |
| `:lieutenant:` | `1573838799157461072` | 中 |
| `:major:` | `1573838801497759927` | 小 |
| `:samurai:` | `1573838803943161898` | 侍 |
| `:lancer:` | `1573838806799486979` | 槍 |
| `:rider:` | `1573838809349750809` | 馬 |
| `:spy:` | `1573838812013138030` | 忍 |
| `:fortress:` | `1573838814546497607` | 砦 |
| `:soldier:` | `1573838817184448554` | 兵 |
| `:cannon:` | `1573838819676004448` | 砲 |
| `:archer:` | `1573838822473605160` | 弓 |
| `:musketeer:` | `1573838825652879451` | 筒 |
| `:tactician:` | `1573838830082203749` | 謀 |
| `:done:` | `1573838837195743314` | 済み, the end of the draft |
| `:tower:` | `1573838839947206739` | a tower of three pieces |
| `:betrayal:` | `1573838842849398944` | a piece changing sides |
| `:drop:` | `1573838845869432972` | 新, a piece dropped from the hand |
| `:check:` | `1573838848629276752` | the Marshal attacked |
| `:brilliant:` | `1573838850936152278` | !! |
| `:good:` | `1573838852999610549` | ! |
| `:interesting:` | `1573838856103534684` | !? |
| `:dubious:` | `1573838858586431568` | ?! |
| `:mistake:` | `1573838860494835774` | ? |
| `:blunder:` | `1573838863149961366` | ?? |

Animated emojis (GIF, 128×128, 20 fps), out of the 50 animated slots; frames from `apps/web/brand/animated/frames.py`:

| Emoji | Id | What |
|---|---|---|
| `:stack:` | `1573841539317104711` | three pieces falling into a tower |
| `:flip:` | `1573841542941249567` | betrayal: a piece turning to the other side and back |
| `:dropping:` | `1573841545990246413` | 新 falling from the hand onto the board |
| `:check_pulse:` | `1573841550130024518` | the Marshal's check glow pulsing |
| `:done_stamp:` | `1573841552646607060` | the 済 stamp landing |
| `:flag:` | `1573841555826020493` | the clock running out and its flag falling |
| `:gg:` | `1573841559517134928` | the two Marshals bowing to each other |
| `:ligungi_build:` | `1573841562264408144` | the logo built layer by layer |

## Stickers

The 5 sticker slots of a server without boosts, all used. Animated PNG, 320×320, 15 fps, from `apps/web/brand/animated/frames.py` (file `media/discord/stickers/<file>.png`).

| Name | Id | Related emoji | Description | File |
|---|---|---|---|---|
| Checkmate | `1573841568069058706` | ⚔️ | The Marshal falls and the 詰み (mate) stamp lands. | `checkmate` |
| Done! | `1573841571974221844` | ✅ | The 済み stamp that ends the draft. | `done` |
| Your move | `1573841574847062060` | ⏳ | A clock ticking and a piece waiting: your turn. | `your_move` |
| Betrayed! | `1573841585840324772` | 😈 | A piece flips to the other side: betrayal. | `betrayed` |
| GG | `1573841589460271144` | 🤝 | The ligungi tower and a big GG. | `gg_tower` |

## Soundboard

The 8 sound slots of a server without boosts, all used, for the voice channels. They are the site's own sounds, unchanged: the sets by Enigmahack from lila (AGPLv3+, see lila's COPYING.md), from `apps/web/src/assets/sound`. The volume evens out their loudness (the 8-bit victory is much louder than the rest).

| Name | Id | Emoji | Volume | Source file |
|---|---|---|---|---|
| Victory | `1573843585529290782` | 🏆 | 80% | `futuristic/Victory.mp3` |
| Defeat | `1573843587299545119` | 💀 | 100% | `sfx/Defeat.mp3` |
| Check | `1573843589853876364` | ⚠️ | 100% | `sfx/Check.mp3` |
| Capture | `1573843591049117819` | 💥 | 100% | `sfx/Capture.mp3` |
| Low time | `1573843593200664708` | ⏰ | 100% | `sfx/LowTime.mp3` |
| New challenge | `1573843595641888911` | ⚔️ | 100% | `sfx/NewChallenge.mp3` |
| Draw | `1573843597202296993` | 🤝 | 90% | `sfx/Draw.mp3` |
| Victory 8-bit | `1573843598657458251` | 🎮 | 50% | `nes/Victory.mp3` |

## Messages posted by the bot

### #rules (message `1573434872037376125`)

Three embeds, color `#d8443f`.

**Server rules**

**1. Be respectful.** Disagree about moves, not about people.

**2. No hate, harassment or threats.** No slurs and no discrimination of any kind.

**3. Fair play.** Never ask for or give help in a game that is still being played, and never use engines or outside help in games against people. Share a game once it is over.

**4. No spam or self-promotion.** Links to your ligungi games, studies and puzzles go in #share-games. Other servers, sites and products need a moderator's OK first.

**5. Suitable for all ages.** No adult, gory or shocking content, in messages, names or avatars.

**6. Spoilers.** Mark HUNTER×HUNTER spoilers as ||spoilers||.

**7. The right language in each channel.** English in #general and the other channels, Portuguese in #português, Spanish in #español.

**8. Discord's rules apply.** Follow the Discord Terms of Service and Community Guidelines. Moderators decide what fits these rules; to contest a decision, message a moderator privately.

**Reporting.** To report a message, open its menu (right click, or long press on a phone) and choose Report Message, or mention @Moderator. Cheating on the site is reported with the report button on the player's profile at ligungi.org.

**Regras (resumo em português)**

1. Respeito: discorde do lance, não da pessoa.
2. Nada de ódio, assédio ou ameaça.
3. Jogo limpo: nunca peça nem dê ajuda em partida em andamento, nem use engine ou ajuda externa contra pessoas.
4. Sem spam nem divulgação. Suas partidas, estudos e puzzles vão em #share-games; outros servidores e produtos só com o ok da moderação.
5. Conteúdo adequado a todas as idades.
6. Spoilers de HUNTER×HUNTER marcados como ||spoiler||.
7. Inglês nos canais gerais, português em #português, espanhol em #español.
8. Valem os termos do Discord; a moderação decide, e para contestar, fale com um moderador no privado.

**Reglas (resumen en español)**

1. Respeto: discrepa de la jugada, no de la persona.
2. Nada de odio, acoso ni amenazas.
3. Juego limpio: nunca pidas ni des ayuda en una partida en curso, ni uses motores o ayuda externa contra personas.
4. Sin spam ni autopromoción. Tus partidas, estudios y puzzles van en #share-games; otros servidores y productos solo con el visto bueno de la moderación.
5. Contenido apto para todas las edades.
6. Spoilers de HUNTER×HUNTER marcados como ||spoiler||.
7. Inglés en los canales generales, portugués en #português, español en #español.
8. Rigen las normas de Discord; la moderación decide, y para reclamar, escribe en privado a un moderador.

### #welcome (message `1573434875833225290`)

Three embeds, color `#d8443f`.

**Welcome to ligungi** (links to https://ligungi.org)

ligungi is a free, open source site to play **Gungi** (軍儀), the strategy board game from HUNTER×HUNTER, with the official 2022 rules. No ads, no account needed to play.

**On the site**
Play: https://ligungi.org
How to play: https://ligungi.org/learn
Lessons: https://ligungi.org/lessons
Puzzles: https://ligungi.org/puzzles
FAQ: https://ligungi.org/faq
Source code: https://github.com/beater-studios/ligungi

**Here**
#rules: read them first
#announcements: new versions and news
#general, #português, #español: chat in English, Portuguese and Spanish
#strategy: positions and how to play better
#share-games: your games, studies and puzzles
#help: questions about the rules, the site or your account
#feedback: suggestions and bugs

Pick your languages and notifications in Channels & Roles at the top of the channel list.

**Bem-vindo ao ligungi** (links to https://ligungi.org/?lang=pt)

O ligungi é um site gratuito e de código aberto para jogar **Gungi** (軍儀), o jogo de tabuleiro de HUNTER×HUNTER, com as regras oficiais de 2022. Sem anúncios e sem precisar de conta para jogar.

Como jogar: https://ligungi.org/learn?lang=pt
Conversa em português: #português
Dúvidas: #help (pode perguntar em português)
Sugestões e bugs: #feedback

**Bienvenido a ligungi** (links to https://ligungi.org/?lang=es)

ligungi es un sitio gratuito y de código abierto para jugar al **Gungi** (軍儀), el juego de mesa de HUNTER×HUNTER, con las reglas oficiales de 2022. Sin anuncios y sin necesidad de cuenta para jugar.

Cómo jugar: https://ligungi.org/learn?lang=es
Charla en español: #español
Dudas: #help (puedes preguntar en español)
Sugerencias y errores: #feedback

### Channel guides (pinned)

One embed each, color `#d8443f`, posted without a ping and pinned in its channel.

**#share-games** (message `1573850834003829014`), "Share your games": Post your games, studies and positions from ligungi.org and tell us the story: a draft you are proud of, a tower that won the game, a blunder you want to understand. How to share: a game, the link in the address bar of the game page, like ligungi.org/abcd1234; a position, set it up in the board editor (ligungi.org/editor) and use Copy link, or paste its FEN; a study, the study's link from ligungi.org/study. Fair play: only games that are over; asking for or giving help in a game still being played breaks rule 3, and so does sharing it while it runs. React with the move annotations (the six annotation emojis).

**#strategy** (message `1573850837560856748`), "Strategy": Talk about how to play better, in any mode: from the Beginner setup to the full Advanced game. Good topics: drafts (what to place first, where the Marshal goes, when to declare done, with :done:), towers (when to stack, betray or keep pieces in hand, with :tower:, :betrayal: and :drop:), pieces (what each one is worth and how they work together), endgames (how to finish a game you are winning). Show the position: link the analysis board (ligungi.org/analysis) or the board editor (ligungi.org/editor), or paste the FEN; the draft explorer (ligungi.org/explorer) shows what players placed in real games. Questions about the rules go in #help, and never ask about a game still being played.

**#off-topic** (message `1573850843759910924`), "Off-topic": Anything that is not about Gungi or ligungi: other games, anime and manga, music, your day. Keep in mind: the server rules still apply here (#rules); mark HUNTER×HUNTER spoilers; no self-promotion, other servers, sites and products need a moderator's OK first; English here, Portuguese and Spanish have their own channels (#português and #español). Gungi talk is welcome too, but it finds more people in #general and #strategy.

**#general** (message `1574477530084286600`), "General": Chat about Gungi and ligungi.org in English: how your games went, questions about the site, ideas, or just saying hello. Find the right place: questions about the rules in #help, positions and how to play better in #strategy, your games and studies in #share-games, suggestions and bugs in #feedback, anything else in #off-topic. Other languages have their own channels: #português and #español. Looking for a game? Post a challenge link (Play with a friend on ligungi.org), or join 🇺🇸 Lounge or Play together 1. Get a rank: link your ligungi account, see #rules. Be kind, and never ask for help in a game still being played (rule 3).

**#português** (message `1574477532408057970`), "Português": the same guide in Portuguese, saying the other channels are in English, pointing to 🇧🇷 Bate-papo for a game and calling the rank "patente".

**#español** (message `1574477534438096897`), "Español": the same guide in Spanish, saying the other channels are in English, pointing to 🇪🇸 Charla for a game and calling the rank "rango".

**#translations** (message `1573851555608793261`), "Translations": Help bring ligungi to your language. English is the source, and Portuguese and Spanish are done. How to translate today: copy `apps/web/src/i18n/locales/en.json` to a file named after your language (`fr.json`, `pt-PT.json`), translate it and open a pull request; leave what you did not translate empty, it shows in English; a language appears on the site once 80% of it is translated. Coming in 2027: Weblate, to translate in the browser without Git, around February 2027. Full guide: Translations in CONTRIBUTING.md (linked). Starting a language? Say so here, so two people do not translate the same one; ask here too about a word, the piece names or a message you are not sure about.

**#development** (message `1573851558914031626`), "Development": Talk about ligungi's code and its rules engine. Start here: the code on GitHub (AGPL-3.0-or-later), CONTRIBUTING.md (setup, checks and conventions), docs/architecture.md, docs/rules.md (from the official 2022 rulebook and FAQ), all linked. Before writing code: for anything bigger than a small fix, open an issue first, so we agree on the approach. Rule changes need a source: the rulebook page or the FAQ question. Security problems never go here: follow SECURITY.md.

### Forum guide posts (pinned)

Plain text, tagged 📌 guide and pinned at the top of the forum.

**#help**, post "How to get help" (`1573851602387865611`): One post per question, with a tag: 📖 rules, 🌐 site or 👤 account. Any language is fine. Before posting: how to play (ligungi.org/learn), lessons (ligungi.org/lessons), FAQ (ligungi.org/faq). A good question has a clear title, like "Can the Spy capture a tower?"; for a position, a link from the board editor or the analysis board, or its FEN; for a problem with the site, what you did, what you expected and what happened, with your browser and device. When it is answered, a moderator marks the post ✅ solved. Never ask about a game that is still being played.

**#feedback**, post "How to send feedback" (`1573851614437974026`): One idea or bug per post, with a tag: 💡 suggestion, 🐛 bug, 🌍 translation or ♿ accessibility. Before posting: search the forum; if it is already there, react 👍 to vote and reply with anything new. For a bug: what you did, what you expected and what happened, with a link to the game if there is one and your browser and device; a screenshot helps. What happens next: confirmed items go to GitHub issues and get 🔗 on GitHub; shipped ones get ✅ done; votes help pick what comes next. Security problems never go here: write privately through ligungi.org/contact.

## Announcements

Every public post by the bot goes first to #mod-previews: a short note saying where it will go and whom it pings, then the message exactly as it will be posted. It is posted only after the maintainer approves it there.

| Date | Message | Content |
|---|---|---|
| 2026-11-23 | `1574473938002776114` | Release 0.9.2 (pinging Updates): rank roles and Linked Roles for linked accounts, the opponent's pieces option (thanking the #feedback suggestion), the pointer for new visitors, and the fixes (secondary buttons, tower strip, libaduk links). |
| 2026-11-22 | `1573883869130661899` | Code infrastructure (no ping): CodeQL and vet scans, CodeRabbit reviews, protected main branch and version tags, the code of conduct, 0.9.1 with a server security update; asks for stars on the GitHub repository (they help discovery, and at 10 CodeRabbit reviews every pull request on its own). |
| 2026-11-21 | `1573850228920946830` | Server makeover (no ping): emojis, animated emojis, stickers, soundboard, player profile roles, a tidier channel list and the Server Home; tells members to pick their profile in Channels & Roles. |
| 2026-11-21 | `1573835375187591270` | Listed on AlternativeTo and Website Launches (no ping): asks players who enjoy the site for a like, an upvote or a comment there. |
| 2026-11-20 | `1573448207281946675` | Release 0.9.0 (pinging Updates): the server, spoken moves, sound sets, translations by volunteers, settings and menus, friendly sites, accessibility. |

## Changes

| Date | Change |
|---|---|
| 2026-11-21 | Player profile roles (mode played most and what they enjoy) and their onboarding questions; default channels cut to 10, the language and project channels shown by the answers. |
| 2026-11-23 | Pinned channel guides in #general, #português and #español (see Messages posted by the bot). No guide in the text chat of the voice channels: only people in the room see it. |
| 2026-11-23 | Rank roles 大 General, 中 Lieutenant General, 小 Major General, 侍 Samurai, 兵 Soldier and Verified player, shown apart below Contributor; Linked Roles fields registered for the app. |
| 2026-11-22 | Language flags in front of the language voice channels (🇺🇸 Lounge, 🇧🇷 Bate-papo, 🇪🇸 Charla). |
| 2026-11-22 | VOICE category below COMMUNITY: Lounge, Bate-papo, Charla, Play together 1 (the old Play together) and Play together 2; the Portuguese and Spanish ones shown by the language answers. System messages found in #mod-chat and kept there. |
| 2026-11-22 | Guides pinned in #translations and #development, and a pinned guide post in each forum; forum tags got emojis and a moderated 📌 guide tag, and both forums 👍 as the default reaction. |
| 2026-11-22 | Pinned channel guides in #share-games, #strategy and #off-topic (see Messages posted by the bot). |
| 2026-11-21 | Soundboard: 8 of the site's sounds (see Soundboard). |
| 2026-11-21 | 8 animated emojis and 5 animated stickers (see Emojis and Stickers). |
| 2026-11-21 | 26 server emojis: the logo, the 14 pieces, five game moments and six move annotations (see Emojis). |
| 2026-11-21 | Language roles renamed to a flag and a short code (🇺🇸 EN, 🇧🇷 BR, 🇪🇸 ES), with the flags on the onboarding options too (titles kept in full). Updates and Events got an emoji (📢, 🏆) and a color (lila's blue and green), on the roles and in onboarding. |
| 2026-11-21 | Channel #mod-previews (STAFF) for approving bot posts before they go public. |
| 2026-11-20 | Short addresses `ligungi.org/discord` and `discord.ligungi.org`. |
| 2026-11-20 | Roles ordered as in the table (the maintainer dragged them once in the app: the bot cannot move roles that share its own position). Server icon set to `apps/web/public/icon-512.png`. |
| 2026-11-20 | Server set up: roles, channels, Community mode, AutoMod, onboarding, welcome screen, rules and welcome messages, permanent invite. Default `#geral` and `Geral` channels and their categories removed. |

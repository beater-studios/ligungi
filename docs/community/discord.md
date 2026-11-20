# Discord server

The record of the ligungi Discord server: its structure, settings and the texts the bot posted. The server is managed through the `discord-ligungi` MCP (the bot `ligungi`, application `1573429066755739949`, with Administrator). Any change made on Discord, by hand or through the bot, is written here in the same change, so the server can be rebuilt from this file.

- Server: `ligungi`, id `1573431103035940956`
- Permanent invite: https://discord.gg/RgtNN7yXU5 (to #welcome, never expires, no use limit)
- Created: 2026-11-20
- Short addresses to share: https://ligungi.org/discord (a temporary redirect by the server, `SHORT_LINKS` in `packages/protocol/src/links.ts`) and https://discord.ligungi.org (a Cloudflare redirect rule to `ligungi.org/discord`, set by `deploy/cloudflare.py redirects`).
- The invite lives in `DISCORD_INVITE` (`packages/protocol/src/links.ts`), used by the server redirect, the footer and the contact page. A new invite means changing it there and in the AutoMod allow list of the invites rule.

## Settings

| Setting | Value |
|---|---|
| Community mode | on |
| Verification level | medium (verified email and an account older than 5 minutes) |
| Explicit content filter | all members |
| Default notifications | only mentions |
| Preferred locale | en-US |
| Rules channel | #rules |
| Community updates and safety alerts | #mod-log |
| System messages | #general: join and boost notices on, setup tips and the sticker reply button off |
| Description | The community of ligungi.org, the free and open source site to play Gungi online with the official 2022 rules. Games, strategy, puzzles, help and feedback, in English, Portuguese and Spanish. |

## Roles

From the top. The bot role `ligungi` (managed, Administrator) must stay above every other role, or the bot cannot manage them.

| Position | Role | Id | Color | Shown apart | Permissions | Who |
|---|---|---|---|---|---|---|
| 8 | ligungi (bot) | `1573431786871197726` | none | no | Administrator | the bot |
| 7 | Moderator | `1573434311749796002` | `#d8443f` | yes | manage messages and threads, timeout, kick, ban, nicknames, audit log, voice moderation, events, pin, mention everyone | moderators (the maintainer) |
| 6 | Contributor | `1573434313847087237` | `#d9a441` | yes | none | people who contributed code, rules or translations |
| 5 | English | `1573434315784851621` | none | no | none | chosen in onboarding |
| 4 | Português | `1573434318204964874` | none | no | none | chosen in onboarding |
| 3 | Español | `1573434319702204457` | none | no | none | chosen in onboarding |
| 2 | Updates | `1573434321446903969` | none | no | none | opt in: pinged for new versions |
| 1 | Events | `1573434322986213519` | none | no | none | opt in: pinged for events and tournaments |

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
| | Play together | `1573434583360213042` | voice | open | |
| PROJECT (`1573434424828362832`) | | | category | open | |
| | #help | `1573434622828744747` | forum, tag required | open | Questions about the rules, the site or your account. One post per question, with a tag. Rules: ligungi.org/learn. FAQ: ligungi.org/faq. |
| | #feedback | `1573434628264558662` | forum, tag required | open | Suggestions and bug reports, one per post, with a tag. For a bug, say what you did, what you expected and what happened, with a link to the game if there is one. Confirmed items go to GitHub issues. Security problems go privately through the contact page, never here. |
| | #translations | `1573434629732442205` | text | open | For volunteers translating ligungi. How to translate: Translations in CONTRIBUTING.md on GitHub. |
| | #development | `1573434631179735093` | text | open | Code, rules engine and contributing to ligungi (AGPL, on GitHub). Start with CONTRIBUTING.md. |
| STAFF (`1573434426476462150`) | | | category | hidden from @everyone; Moderator can view, send and read history | |
| | #mod-chat | `1573434482227155135` | text | moderators only | Moderators only. |
| | #mod-log | `1573434485050056734` | text | moderators only | AutoMod alerts and Discord notices. Moderators only. |

Forum tags (tags marked moderated can only be set by moderators):

- #help: `rules`, `site`, `account`, `solved` (moderated)
- #feedback: `suggestion`, `bug`, `translation`, `accessibility`, `on GitHub` (moderated), `done` (moderated)

## AutoMod

All rules block the message and alert #mod-log.

| Rule | Id | Trigger | Details | Exempt |
|---|---|---|---|---|
| Slurs and sexual content | `1573434760238202983` | Discord's lists | slurs, sexual content | #mod-chat, #mod-log |
| Mention spam | `1573434762360791172` | mentions | more than 5 unique mentions, raid protection, 10 minute timeout | Moderator |
| Invites to other servers | `1573435056838545549` | regex `(?i)(discord\.gg\|discord(app)?\.com/invite\|dsc\.gg)/[a-z0-9-]+` | allowed: `discord.gg/RgtNN7yXU5`, `discord.com/invite/RgtNN7yXU5` | Moderator |
| Spam | `1573434766143782942` | Discord's spam detection | | Moderator |

## Onboarding and welcome screen

Onboarding is on (default mode). Every channel outside STAFF is a default channel. Questions, both optional and multiple choice:

1. "Which languages do you speak?": English (Chat in #general), Português (Conversa em #português), Español (Charla en #español), each giving its language role.
2. "What would you like to hear about?": Site updates (A ping when a new version of ligungi.org comes out) gives Updates; Events (A ping for tournaments and community events) gives Events.

Welcome screen description: "Play Gungi online at ligungi.org, with the official rules. Talk strategy, share your games and help shape the site." Channels: #rules (Read the rules first), #general (Say hello), #help (Ask about the rules or the site), #share-games (Share your games), #announcements (News and new versions).

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

## Changes

| Date | Change |
|---|---|
| 2026-11-20 | Short addresses `ligungi.org/discord` and `discord.ligungi.org`. |
| 2026-11-20 | Roles ordered as in the table (the maintainer dragged them once in the app: the bot cannot move roles that share its own position). Server icon set to `apps/web/public/icon-512.png`. |
| 2026-11-20 | Server set up: roles, channels, Community mode, AutoMod, onboarding, welcome screen, rules and welcome messages, permanent invite. Default `#geral` and `Geral` channels and their categories removed. |

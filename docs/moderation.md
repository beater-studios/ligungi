# Moderation

How ligungi is moderated: who moderates, what each action does and where it shows. The terms of use describe it to players (Terms > Conduct).

## Moderators

There is no way to become a moderator from the site. The role is set on the server, with the command that runs next to the app on the same database:

```sh
npm run cli -w @ligungi/server -- moderator add <username>
npm run cli -w @ligungi/server -- moderator remove <username>
npm run cli -w @ligungi/server -- moderator list
```

Set `DATABASE_PATH` as for the server. In the Docker image the command is `node apps/server/src/cli.ts moderator add <username>` inside the app container. Granting and removing the role go to the moderation log as actions by `server`.

Moderators get a Moderation link in the account menu (the `/mod` page), a moderation card on other players' profiles and a button to void games. Moderators cannot act on other moderators, themselves included: only the server command changes them.

## Reports

Any signed-in player can report another from their profile or from a game against them, with a reason (cheating, offensive name or profile, behavior, other) and up to 500 characters. One open report per reporter and player at a time, and at most 10 reports per hour. Open reports are listed on `/mod`; a moderator closes one with a note on how it was resolved.

## Actions

Every action asks for a reason and goes to the moderation log with the moderator, the date and the details.

- **Suspend**, for 1, 3, 7 or 30 days or for good. The account's sessions end and its sockets close, its seeks and open challenges are canceled, and its games in progress are lost by abandonment (or aborted before both players have moved). Signing in is refused with the end of the suspension and the reason. A temporary suspension ends by itself; a permanent one (a ban) also leaves the player out of the leaderboards until a moderator lifts it.
- **Lift a suspension**, at any time.
- **Rename** an offensive username. The new name replaces the old one everywhere it is stored, game histories included, so the old name does not stay visible.
- **Clear a profile**: deletes the bio and the linked profiles that offend or point to inappropriate content. The country stays. Links can only name a player on a fixed list of sites, so a profile never points to an arbitrary address, but the page there can still be inappropriate.
- **Void a game** won by cheating (finished and rated only). Each player's rating change from that game is undone on their current rating: the loser gets the points back and the winner loses those gained. The game stays in the history, marked as voided, and leaves the win, draw and loss counts.

## Privacy

Reports are deleted together with either account. The moderation log keeps its entries after an account is deleted, as the record of the decisions taken. A player's data download includes the reports they made and the actions taken on their account, without naming the moderator.

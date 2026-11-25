import { loadConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { DiscordLinks } from './discord.ts';
import { Moderation, moderatorCommand } from './moderation.ts';
import { Users } from './users.ts';

/** Maintenance commands run on the server, next to the running app (same database). See docs/moderation.md. */
const config = loadConfig();
const db = openDatabase(config.databasePath);
const args = process.argv.slice(2);
if (args[0] === 'discord') {
  // Registers the Linked Roles fields with Discord; run once after setting the Discord variables, and when they change.
  if (args[1] !== 'metadata') {
    console.log('usage: discord metadata');
    process.exitCode = 2;
  } else {
    try {
      await new DiscordLinks(db, new Users(db, config.now), { config: config.discord, fetch: config.fetch, now: config.now }).registerMetadata();
      console.log('Linked Roles fields registered');
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
} else {
  const result = moderatorCommand(new Moderation(db, config.now), new Users(db, config.now), args);
  console.log(result.output);
  process.exitCode = result.code;
}
db.close();

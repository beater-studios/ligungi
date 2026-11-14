import { loadConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { Moderation, moderatorCommand } from './moderation.ts';
import { Users } from './users.ts';

/** Maintenance commands run on the server, next to the running app (same database). See docs/moderation.md. */
const config = loadConfig();
const db = openDatabase(config.databasePath);
const result = moderatorCommand(new Moderation(db, config.now), new Users(db, config.now), process.argv.slice(2));
db.close();
console.log(result.output);
process.exitCode = result.code;

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp(config);

app.server.listen(config.port, config.host, () => {
  console.log(`ligungi server listening on http://${config.host}:${config.port}`);
});

const shutdown = () => {
  console.log('shutting down');
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

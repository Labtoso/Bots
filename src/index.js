import { config } from './config.js';
import { log } from './log.js';
import { ensureTunnelBinary } from './binaries.js';
import { createApi } from './api.js';
import { startTunnel } from './tunnel.js';
import { createBot } from './bot.js';
import { startUpdater } from './updater.js';
import { flushAll } from './store.js';

async function main() {
  const useTunnel = !config.publicUrl && config.tunnel !== 'off';
  if (useTunnel) await ensureTunnelBinary();
  const bot = createBot();
  const api = createApi(bot);
  await new Promise((r) => api.listen(config.port, r));
  log.info(`API läuft auf Port ${config.port}`);

  let publicUrl = config.publicUrl || `http://localhost:${config.port}`;
  if (useTunnel) {
    publicUrl = await startTunnel(config.port);
    log.info(`Öffentliche API-Adresse: ${publicUrl}`);
  }
  bot.setPublicUrl(publicUrl);
  await bot.start();
  startUpdater();
}

process.on('unhandledRejection', (e) => log.error(e?.stack || e));
main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushAll(); process.exit(0); });

import { config } from './config.js';
import { log } from './log.js';
import { ensureBinaries } from './binaries.js';
import { createApi } from './api.js';
import { startTunnel } from './tunnel.js';

async function main() {
  const useTunnel = !config.publicUrl && config.tunnel !== 'off';
  await ensureBinaries({ tunnel: useTunnel });

  const bot = config.mock ? (await import('./mock.js')).createMockBot() : (await import('./discord.js')).createDiscordBot();
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
}

process.on('unhandledRejection', (e) => log.error(e?.stack || e));
main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));

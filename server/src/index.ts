/**
 * PM2 / cluster entry — her instance RejiServer açar.
 * Cluster mode: pm2 ecosystem.exec_mode = cluster
 */

import { bootMain } from './main';

void bootMain().catch((err) => {
  console.error('[reji] fatal', err);
  process.exit(1);
});

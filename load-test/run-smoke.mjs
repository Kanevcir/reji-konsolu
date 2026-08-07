/**
 * Prefers k6 when available; otherwise Node smoke (same :8080 profile).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.LOADTEST_BASE_URL || 'http://127.0.0.1:8080';
const ws = process.env.LOADTEST_WS_URL || 'ws://127.0.0.1:8080/ws';

const k6Args = [
  'run',
  `-eLOADTEST_BASE_URL=${base}`,
  `-eLOADTEST_WS_URL=${ws}`,
  '-eLOADTEST_VUS=20',
  '-eLOADTEST_RAMP_UP=5s',
  '-eLOADTEST_HOLD=15s',
  '-eLOADTEST_RAMP_DOWN=5s',
  '-eLOADTEST_SESSION_SEC=12',
  path.join(root, 'load-test', 'load-test.js'),
];

function tryK6() {
  const candidates = [
    process.env.K6_BIN,
    'k6',
    path.join(process.env.TEMP || '/tmp', 'k6-bin', 'k6.exe'),
    path.join(process.env.TEMP || '/tmp', 'k6-bin', 'k6-v1.0.0-windows-amd64', 'k6.exe'),
    path.join(process.env.TEMP || '/tmp', 'k6-bin', 'k6-v0.57.0-windows-amd64', 'k6.exe'),
  ].filter(Boolean);

  for (const bin of candidates) {
    const probe = spawnSync(bin, ['version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      console.log(`Using k6: ${bin}`);
      const run = spawnSync(bin, k6Args, { stdio: 'inherit', cwd: root, env: process.env });
      process.exit(run.status ?? 1);
    }
  }
  return false;
}

if (!tryK6()) {
  console.log('k6 not found — running Node smoke equivalent');
  const run = spawnSync(process.execPath, [path.join(root, 'load-test', 'smoke-node.mjs')], {
    stdio: 'inherit',
    cwd: root,
    env: {
      ...process.env,
      LOADTEST_BASE_URL: base,
      LOADTEST_WS_URL: ws,
      LOADTEST_VUS: process.env.LOADTEST_VUS || '20',
      LOADTEST_SESSION_SEC: process.env.LOADTEST_SESSION_SEC || '12',
    },
  });
  process.exit(run.status ?? 1);
}

/**
 * PM2 process file — cluster mode (yatay ölçek / çoklu worker).
 * Docker: pm2-runtime start server/ecosystem.config.cjs
 */

const instances = process.env.WEB_CONCURRENCY
  ? Number.parseInt(process.env.WEB_CONCURRENCY, 10)
  : process.env.PM2_INSTANCES
    ? Number.parseInt(process.env.PM2_INSTANCES, 10)
    : 2;

module.exports = {
  apps: [
    {
      name: 'reji-api',
      script: 'server/src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: Number.isFinite(instances) && instances > 0 ? instances : 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      kill_timeout: 8_000,
      listen_timeout: 10_000,
    },
  ],
};

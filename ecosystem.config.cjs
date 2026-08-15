// PM2 — UniPrésence
module.exports = {
  apps: [
    {
      name: 'unipresence-api',
      cwd: '/opt/apps/unipresence/backend',
      script: 'dist/main.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5031,
      },
      max_memory_restart: '400M',
      error_file: '/var/log/pm2/unipresence-api-error.log',
      out_file: '/var/log/pm2/unipresence-api-out.log',
    },
  ],
};

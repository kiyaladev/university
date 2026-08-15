// PM2 — University
module.exports = {
  apps: [
    {
      name: 'university-api',
      cwd: '/opt/apps/university/backend',
      script: 'dist/main.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5081,
      },
      max_memory_restart: '400M',
      error_file: '/var/log/pm2/university-api-error.log',
      out_file: '/var/log/pm2/university-api-out.log',
    },
  ],
};

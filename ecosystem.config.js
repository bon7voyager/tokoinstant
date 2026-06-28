// PM2 process manager config for Kilat.
// Start:   pm2 start ecosystem.config.js
// Reload:  pm2 reload kilat
// Logs:    pm2 logs kilat
module.exports = {
  apps: [
    {
      name: "kilat",
      cwd: "/var/www/kilat", // <-- adjust to where you cloned the project
      script: "npm",
      args: "start", // runs `next start`
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};

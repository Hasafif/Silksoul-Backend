module.exports = {
  apps: [{
    name: 'backend',
    script: './bin/www.js', // or './dist/app.js' if using build process
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // PM2 configuration
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Auto-restart configuration
    min_uptime: '10s',
    max_restarts: 10,
    
    // Health monitoring
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000
  }]
};
# Self-Hosting Guide

Oggo is built to be self-hosted on your own hardware or VPS.

> **⚠️ IMPORTANT LICENSE NOTICE:**
> Oggo is licensed under the **Business Source License 1.1**. While you are free to self-host Oggo for your personal, internal, and non-commercial needs, **you may not offer Oggo as a hosted, managed, or SaaS service to third parties**. Reselling the software or offering it as a commercial hosted service is strictly prohibited.

## Option 1: Using PM2 (Recommended)

PM2 is a production process manager for Node.js.

1. Install PM2 globally:
   ```bash
   npm install pm2 -g
   ```
2. Navigate to your Oggo directory and install dependencies:
   ```bash
   cd /path/to/oggo
   npm ci
   ```
3. Start Oggo with PM2:
   ```bash
   pm2 start bin/oggo.js --name "oggo" -- start
   ```
4. Setup PM2 to restart on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

## Option 2: Docker (Community Contributed)

*Note: An official Dockerfile will be added in a future release.*

If you build your own Docker image, ensure you map a persistent volume to the database path (`DB_PATH`) and `.tldr` cache directory to prevent data loss when the container restarts.

## Security Considerations

1. **Reverse Proxy:** We strongly recommend placing Oggo behind a reverse proxy like Nginx or Caddy, configured with SSL/TLS (HTTPS).
2. **Authentication:** Ensure you do not expose the Oggo dashboard to the public internet without proper authentication, as it grants direct SSH and command execution access.
3. **Encryption Key:** Backup your `ENCRYPTION_SECRET`. If you lose it, you will not be able to decrypt your stored SSH passwords or keys.

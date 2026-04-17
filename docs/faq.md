# Frequently Asked Questions

### Can I use Oggo commercially?

Oggo is licensed under the **Business Source License 1.1**. This means you are free to use it internally at your company, for your own servers, or for non-commercial projects. However, you **cannot** take Oggo and offer it as a hosted service (SaaS) to third parties, nor can you resell the software itself.

### Does Oggo support SSH keys?

Yes! Oggo fully supports SSH keys. You can upload an existing key, paste the raw key content, or let Oggo generate a new RSA/ED25519 keypair for you. All sensitive credentials are encrypted using AES.

### Why doesn't the terminal autocomplete `mkd` to `mkdir`?

Make sure you're using the latest version of Oggo. We've recently integrated the official `tldr` npm package with fuzzy searching via `fuse.js` to provide intelligent, aliased autocomplete for commands.

### Can I run jobs without opening a terminal window?

Absolutely. On Windows and Linux, background cron jobs run entirely hidden (`windowsHide: true`) without popping up new terminal windows.

### Where is my data stored?

All your jobs, logs, server configurations, and history are stored locally in an SQLite database (by default at `./oggo.db`). Your `.tldr` cache is typically stored in `~/.tldr/`.

# Oggo

[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-orange.svg)](https://opensource.org/licenses/BSL-1.1)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-blue.svg)](#)

> A production-grade, self-hosted cron job and server management platform with a built-in SSH terminal.
> Originally built as my own personal ops/control center on my machine — now open-sourced so everything lives in one place. Over time this will grow to include more of my real-world tools from my old setup: AWS helpers, mail systems, SMB viewer, database backup automation, notes, and a password manager.

---

## 📸 Overview

![Oggo Dashboard Screenshot](./docs/assets/screenshot.png)

*A placeholder for a beautiful screenshot of the Oggo dashboard and SSH terminal.*

## ✨ Features

- **Robust Job Management:** Create, schedule, and monitor cron jobs across multiple environments.
- **Built-in SSH Terminal:** Native-feeling, WebSocket-powered terminal via `xterm.js` to manage your remote servers directly from the browser.
- **Command Intelligence:** Smart, fuzzy-search autocomplete for terminal commands using official `tldr` data.
- **Encrypted Credentials:** Secure AES encryption for all stored passwords and SSH keys.
- **Modern UI:** Professional dark/light mode interface built with Vanilla JS, Tailwind CSS, and Lucide icons.
- **Real-time Analytics:** Built-in charts and execution tracking.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, SQLite (`better-sqlite3`), `node-cron`, `ssh2`, `ws` (WebSockets), `node-pty`, `crypto-js`
- **Frontend:** Vanilla JS, Tailwind CSS, Lucide Icons, Chart.js, `xterm.js`

## 🚀 Quick Start

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

```bash
# 1. Clone the repository
git clone https://github.com/chapeee/oggo.git
cd oggo

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

On first run, Oggo now asks what database you want to use:

- `SQLite` for the current local-file setup
- `MySQL` if you want a server database

If you choose MySQL, the installer asks one-by-one for:

- host / URL
- port
- username
- password
- database name

Once running, Oggo will be available at `http://localhost:3030` (or the port specified in your config).

## 🏠 Self-Hosting

Oggo is designed to be self-hosted on your own infrastructure. For detailed instructions on setting up Oggo via Docker, PM2, or systemd, please refer to the [Self-Hosting Guide](docs/self-hosting.md).

**Important Note on Self-Hosting:** Oggo is provided under a source-available license. You are fully encouraged to self-host Oggo for your personal, internal, and non-commercial operations. However, **you may not offer Oggo as a hosted, managed, or SaaS service to third parties**, nor may you resell it.

## 🤝 Contributing

We welcome contributions from the community! Whether it's a bug fix, a new feature, or documentation improvements, please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a Pull Request.

All contributions are licensed under the project's license.

## 🛡️ Security

If you discover a security vulnerability, please do not open a public issue. Review our [Security Policy](SECURITY.md) for instructions on how to report it privately.

## ⚖️ License

Oggo is source-available and licensed under the **Business Source License 1.1 (BUSL-1.1)**. 

- **You CAN:** Use Oggo freely for personal, internal, and non-commercial purposes.
- **You CANNOT:** Provide Oggo as a hosted or managed service (SaaS) to third parties, or resell the software.

After 4 years, the license for each specific version automatically converts to the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for the exact terms.

## 💬 Community

- [GitHub Issues](https://github.com/chapeee/oggo/issues) - For bug reports and feature requests.
- [Discussions](https://github.com/chapeee/oggo/discussions) - For questions, troubleshooting, and showing off your setups.

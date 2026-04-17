# Architecture Overview

Oggo is built as a monolithic Node.js application that handles both frontend serving and backend execution.

## Backend Stack

- **Framework:** Express.js handles API routes and serves the static frontend assets.
- **Database:** `better-sqlite3` is used for synchronous, high-performance local SQLite storage.
- **Cron Engine:** `node-cron` parses schedule strings and triggers job execution.
- **SSH & Terminal:**
  - `ssh2` establishes secure connections to remote servers.
  - `ws` (WebSockets) streams terminal output directly to the browser.
- **Command Intelligence:** Parses and caches the official `tldr` repository to provide smart terminal suggestions, backed by `fuse.js` for fuzzy matching.

## Frontend Stack

- **UI:** Vanilla JavaScript with Tailwind CSS for utility-first styling.
- **Icons:** Lucide Icons (loaded via CDN).
- **Terminal UI:** `xterm.js` paired with custom key handlers and overlay logic.
- **State Management:** A lightweight, global `state` object and manual DOM updates (`render()`) to keep dependencies low.

## Data Flow (Terminal)

1. User clicks "SSH Terminal".
2. Frontend opens a WebSocket connection to `ws://localhost:3030/terminal/:serverId`.
3. Backend retrieves encrypted credentials from SQLite, decrypts them via `crypto-js`, and initiates an `ssh2` shell.
4. Data piped from `ssh2` is sent via WebSocket to `xterm.js`.
5. User keystrokes are sent via WebSocket back to `ssh2`.

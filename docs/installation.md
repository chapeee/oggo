# Installation

This guide covers how to set up Oggo for local development and basic usage.

## Prerequisites

- Node.js v18.x or higher
- Git

## Step 1: Clone the Repository

```bash
git clone https://github.com/chapeee/oggo.git
cd oggo
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and configure your settings. Most defaults are perfectly fine for local testing, but you should definitely change the `ENCRYPTION_SECRET` to a strong random string to secure your SSH passwords.

## Step 4: Run the Server

You can run Oggo in development or production mode.

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## Next Steps

Open your browser and navigate to `http://localhost:3030`. From there, you can start adding your first Cron job or connecting to an SSH server!

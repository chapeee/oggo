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

## Step 3: Run the Server

You can run Oggo in development or production mode.

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

On first run, Oggo asks which database backend you want to use:

- `SQLite` for simple local storage
- `MySQL` for external database storage

If you choose MySQL, Oggo asks for the details one by one during installation:

- host / URL
- port
- username
- password
- database name

## Next Steps

Open your browser and navigate to `http://localhost:3030`. From there, you can start adding your first Cron job or connecting to an SSH server!

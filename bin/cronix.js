#!/usr/bin/env node

// Backward-compatible CLI entry point.
// This keeps old commands like `node bin/cronix.js start` working
// after the product was renamed to Oggo.
require("./oggo.js");


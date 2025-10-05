#!/usr/bin/env node
const path = require('node:path');
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-ts <path-to-ts-file>');
  process.exit(1);
}
const target = args[0];
const resolved = path.resolve(target);
if (!process.env.TS_PROJECT) {
  process.env.TS_PROJECT = path.resolve(__dirname, '../tsconfig.json');
}
require('./register-ts');
require(resolved);

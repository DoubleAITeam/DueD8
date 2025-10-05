#!/usr/bin/env node
const path = require('node:path');
if (!process.env.TS_PROJECT) {
  process.env.TS_PROJECT = path.resolve(__dirname, '../tsconfig.json');
}
require('./register-ts');
require('./updateChangelog.ts');

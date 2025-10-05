#!/usr/bin/env node
const path = require('node:path');
const { run: buildDeliverables } = require('../scripts/build-deliverables.js');

const outDir = buildDeliverables();
const { runCLI } = require(path.join(outDir, 'cli.js'));

runCLI(process.argv.slice(2))
  .then((code) => {
    process.exit(code ?? 0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });

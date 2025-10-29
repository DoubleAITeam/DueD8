#!/usr/bin/env ts-node
/* eslint-disable no-console */

import path from 'node:path';

async function main() {
  const targetDir = process.argv[2] ?? path.resolve(process.cwd(), 'uploads');
  console.log(`[embeddings] Scanning ${targetDir} for documents…`);
  console.log('[embeddings] Placeholder implementation. Add embedding backfill logic when vector store is configured.');
}

void main();

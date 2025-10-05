import { mkdtemp, writeFile, readFile, rm, readdir, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import Module from 'node:module';

async function ensureExists(target: string): Promise<void> {
  const stats = await stat(target);
  assert.ok(stats.isFile() || stats.isDirectory(), `${target} should exist`);
}

function stubElectron(userData: string): { sentMessages: Array<{ channel: string; payload: unknown }> } {
  const electronPath = require.resolve('electron');
  let currentUserData = userData;
  const sentMessages: Array<{ channel: string; payload: unknown }> = [];
  const appStub = {
    commandLine: { appendSwitch: () => {} },
    disableHardwareAcceleration: () => {},
    whenReady: async () => {},
    getPath: (name: string) => (name === 'userData' ? currentUserData : userData),
    setPath: (name: string, value: string) => {
      if (name === 'userData') {
        currentUserData = path.resolve(value);
      }
    },
    quit: async () => {}
  };
  const browserWindowStub = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, payload: unknown) => {
            sentMessages.push({ channel, payload });
          }
        }
      }
    ]
  };
  const electronStub = { app: appStub, BrowserWindow: browserWindowStub };
  const localRequire: NodeRequire = Module.createRequire(electronPath);
  const moduleStub: NodeModule = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: electronStub,
    children: [],
    paths: [],
    parent: null,
    path: path.dirname(electronPath),
    isPreloading: false,
    require: localRequire
  };
  require.cache[electronPath] = moduleStub;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._cache = require.cache;
  return { sentMessages };
}

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'deliverables-smoke-'));
  await mkdir(tempRoot, { recursive: true });
  const { sentMessages } = stubElectron(tempRoot);

  const {
    runDeliverablePipeline
  } = require('../../electron/deliverables/pipeline') as typeof import('../../electron/deliverables/pipeline');
  const { buildRunSummary } = require('../../electron/deliverables/summary') as typeof import('../../electron/deliverables/summary');
  const {
    buildBaseInsights
  } = require('../../electron/deliverables/insights/build') as typeof import('../../electron/deliverables/insights/build');
  const { zipRun } = require('../../electron/deliverables/archive') as typeof import('../../electron/deliverables/archive');
  const {
    sweepOldOutputs
  } = require('../../electron/deliverables/retention') as typeof import('../../electron/deliverables/retention');

  const samplePath = path.join(tempRoot, 'sample.html');
  await writeFile(samplePath, '<html><body><h1>Smoke Test</h1></body></html>', 'utf8');

  const { run } = await runDeliverablePipeline(
    [
      {
        id: 'sample-artifact',
        srcPath: samplePath,
        type: 'html'
      }
    ],
    { dryRun: true }
  );

  assert.ok(run.runId, 'Run should return a runId');
  const runsFile = path.join(tempRoot, 'deliverables', 'runs.json');
  await ensureExists(runsFile);
  const runs = JSON.parse(await readFile(runsFile, 'utf8')) as Array<{ runId: string }>;
  const latestRun = runs[runs.length - 1];
  assert.ok(latestRun?.runId, 'Latest run should exist');

  const summary = buildRunSummary(run);
  assert.ok(summary.totals.count >= 0, 'Summary should include totals');
  const summaryFile = path.join(tempRoot, 'deliverables', 'runs.summary.json');
  await ensureExists(summaryFile);
  const summaries = JSON.parse(await readFile(summaryFile, 'utf8')) as Record<string, unknown>;
  assert.ok(summaries[latestRun.runId], 'Summary file should include run entry');

  const insights = await buildBaseInsights(run, { limit: 1 });
  assert.ok(Object.keys(insights.base).length > 0, 'Insights should be generated');
  const insightsPath = path.join(tempRoot, 'deliverables', 'insights', `${run.runId}.json`);
  await ensureExists(insightsPath);

  const archiveResult = await zipRun(run.runId);
  assert.ok(archiveResult.ok, archiveResult.message ?? 'Archive should succeed');
  assert.ok(archiveResult.archivePath, 'Archive should return path');
  if (archiveResult.archivePath) {
    await ensureExists(archiveResult.archivePath);
  }
  const archivesDir = path.join(tempRoot, 'deliverables', 'archives');
  const archiveFiles = await readdir(archivesDir);
  assert.ok(archiveFiles.length > 0, 'Archives directory should contain files');

  const sweepResult = await sweepOldOutputs({ dryRun: true });
  assert.ok(typeof sweepResult.removed.length === 'number');
  assert.ok(typeof sweepResult.kept.length === 'number');

  const tokenBudget = require('../../electron/tokenBudget') as typeof import('../../electron/tokenBudget');
  tokenBudget.resetBudget();
  tokenBudget.setCap(50);
  tokenBudget.incrementUsage(60);
  assert.ok(tokenBudget.getBudgetState().isOverCap, 'Budget should be marked over cap');

  const budgetGate = require('../../electron/guards/budgetGate') as typeof import('../../electron/guards/budgetGate');
  assert.throws(
    () => budgetGate.assertBudgetAvailable('smoke.budget'),
    (error: unknown) => error instanceof budgetGate.BudgetExceededError
  );

  const blockedMessages = sentMessages.filter((message) => message.channel === 'budget:blocked');
  assert.strictEqual(blockedMessages.length, 1, 'budget:blocked should emit exactly once');

  await rm(tempRoot, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

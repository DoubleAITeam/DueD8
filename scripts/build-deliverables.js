#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');

function loadConfig(root) {
  const configPath = path.join(root, 'tsconfig.deliverables.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    throw new Error(`Failed to read tsconfig.deliverables.json: ${message}`);
  }
  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function transpile(fileNames, options, outDir, rootDir) {
  const emitted = [];
  for (const fileName of fileNames) {
    const source = fs.readFileSync(fileName, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: options,
      fileName
    });
    const relative = path.relative(rootDir, fileName);
    const destination = path.join(outDir, relative).replace(/\.ts$/, '.js');
    ensureDirectory(path.dirname(destination));
    fs.writeFileSync(destination, transpiled.outputText, 'utf8');
    emitted.push(destination);
  }
  return emitted;
}

function buildDeliverables() {
  const root = path.resolve(__dirname, '..');
  const parsed = loadConfig(root);
  const deliverablesRoot = path.join(root, 'electron', 'deliverables');
  const fileNames = parsed.fileNames.filter((file) => file.startsWith(deliverablesRoot));
  const outDir = path.join(root, 'build', 'deliverables');
  fs.rmSync(outDir, { recursive: true, force: true });
  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true
  };
  transpile(fileNames, compilerOptions, outDir, deliverablesRoot);
  return outDir;
}

function run() {
  try {
    const outDir = buildDeliverables();
    console.log(`Deliverables compiled to ${outDir}`);
    return outDir;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { buildDeliverables, run };

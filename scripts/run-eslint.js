#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function parseArgs(argv) {
  const extensions = new Set(['.ts']);
  const targets = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ext') {
      const value = argv[i + 1];
      if (value) {
        for (const ext of value.split(',')) {
          const trimmed = ext.trim();
          if (trimmed) {
            extensions.add(trimmed.startsWith('.') ? trimmed : `.${trimmed}`);
          }
        }
        i += 1;
      }
    } else if (!arg.startsWith('-')) {
      targets.push(arg);
    }
  }
  if (targets.length === 0) {
    targets.push('.');
  }
  return { extensions, targets };
}

function collectFiles(entry, extensions, bucket) {
  if (!fs.existsSync(entry)) {
    return;
  }
  const stats = fs.statSync(entry);
  if (stats.isDirectory()) {
    const base = path.basename(entry);
    if (base === 'node_modules' || base === '.git' || base === 'dist' || base.startsWith('.')) {
      return;
    }
    for (const child of fs.readdirSync(entry)) {
      collectFiles(path.join(entry, child), extensions, bucket);
    }
    return;
  }
  if (!stats.isFile()) {
    return;
  }
  const ext = path.extname(entry);
  if (extensions.has(ext)) {
    bucket.add(path.resolve(entry));
  }
}

function loadCompilerOptions(projectPath) {
  try {
    const configFile = ts.readConfigFile(projectPath, ts.sys.readFile);
    if (configFile.error) {
      const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
      throw new Error(message);
    }
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(projectPath));
    return parsed.options;
  } catch (error) {
    console.warn(`[lint] Failed to load tsconfig ${projectPath}: ${error instanceof Error ? error.message : error}`);
    return {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      resolveJsonModule: true,
      skipLibCheck: true
    };
  }
}

function report(messages) {
  for (const message of messages) {
    const { file, line, column, rule, text } = message;
    console.error(`${file}:${line}:${column} ${rule} ${text}`);
  }
}

function checkExplicitBoundary(node, sourceFile, messages) {
  if (ts.isFunctionDeclaration(node)) {
    const hasExport = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (hasExport && !node.type) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.name?.getStart() ?? node.getStart());
      messages.push({
        file: sourceFile.fileName,
        line: line + 1,
        column: character + 1,
        rule: 'explicit-module-boundary-types',
        text: 'Exported function must declare an explicit return type.'
      });
    }
  }

  if (ts.isVariableStatement(node)) {
    const hasExport = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!hasExport) {
      return;
    }
    for (const declaration of node.declarationList.declarations) {
      if (!declaration.type && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.name.getStart());
        messages.push({
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          rule: 'explicit-module-boundary-types',
          text: 'Exported function must declare an explicit return type.'
        });
      }
    }
  }
}

function isHandledPromiseExpression(expression) {
  if (ts.isAwaitExpression(expression)) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.VoidKeyword) {
    return true;
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const name = expression.expression.name.text;
    if (name === 'then' || name === 'catch' || name === 'finally') {
      return true;
    }
  }
  return false;
}

function checkFloatingPromises(node, sourceFile, checker, messages) {
  if (!ts.isExpressionStatement(node)) {
    return;
  }
  const expression = node.expression;
  if (isHandledPromiseExpression(expression)) {
    return;
  }

  let type;
  try {
    type = checker.getTypeAtLocation(expression);
  } catch {
    type = null;
  }
  if (!type) {
    return;
  }
  try {
    const promised = checker.getPromisedTypeOfPromise(type);
    if (promised) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(expression.getStart());
      messages.push({
        file: sourceFile.fileName,
        line: line + 1,
        column: character + 1,
        rule: 'no-floating-promises',
        text: 'Promise-returning call must be awaited, returned, or otherwise handled.'
      });
    }
  } catch {
    // ignore failures resolving promise type
  }
}

function lintFiles(filePaths, projectOptions) {
  const compilerOptions = { ...projectOptions, noEmit: true };
  const program = ts.createProgram(filePaths, compilerOptions);
  const checker = program.getTypeChecker();
  const messages = [];

  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      continue;
    }
    const visit = (node) => {
      checkExplicitBoundary(node, sourceFile, messages);
      checkFloatingPromises(node, sourceFile, checker, messages);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  return messages;
}

function main() {
  const { extensions, targets } = parseArgs(process.argv.slice(2));
  const files = new Set();
  for (const target of targets) {
    collectFiles(path.resolve(target), extensions, files);
  }
  const filePaths = Array.from(files);
  if (filePaths.length === 0) {
    console.log('No matching files.');
    return 0;
  }

  const projectPath = process.env.TS_PROJECT || path.resolve(__dirname, '..', 'tsconfig.json');
  const compilerOptions = loadCompilerOptions(projectPath);
  const messages = lintFiles(filePaths, compilerOptions);
  if (messages.length > 0) {
    report(messages);
    return 1;
  }
  console.log(`Checked ${filePaths.length} file(s); no lint errors.`);
  return 0;
}

const exitCode = main();
process.exit(exitCode);

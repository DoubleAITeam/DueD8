const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadCompilerOptions(projectPath) {
  const configPath = path.resolve(projectPath);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    throw new Error(`Failed to read tsconfig at ${configPath}: ${message}`);
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  return parsed.options;
}

const defaultOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  resolveJsonModule: true,
  skipLibCheck: true
};

function register(customProject) {
  const project = customProject || process.env.TS_PROJECT || path.resolve(__dirname, '..', 'tsconfig.json');
  let compilerOptions = defaultOptions;
  try {
    const projectOptions = loadCompilerOptions(project);
    compilerOptions = { ...projectOptions, ...defaultOptions };
  } catch (error) {
    console.warn(`[register-ts] Falling back to default compiler options: ${error instanceof Error ? error.message : error}`);
  }

  require.extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions,
      fileName: filename,
      reportDiagnostics: false
    });
    const virtualFileName = filename.replace(/\.ts$/, '.js');
    module._compile(transpiled.outputText, virtualFileName);
  };
}

register();

module.exports = { register };

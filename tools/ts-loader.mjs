import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  resolveJsonModule: true,
  isolatedModules: true,
  jsx: ts.JsxEmit.React
};

export async function load(url, context, defaultLoad) {
  if (url.endsWith('.ts')) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, 'utf8');
    const result = ts.transpileModule(source, { compilerOptions, fileName: filePath });
    return {
      format: 'module',
      source: result.outputText,
      shortCircuit: true
    };
  }
  return defaultLoad(url, context, defaultLoad);
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!specifier.endsWith('.ts')) {
      const resolved = await defaultResolve(specifier + '.ts', context, defaultResolve).catch(() => null);
      if (resolved) {
        return resolved;
      }
    }
    if (specifier.startsWith('file:')) {
      return { shortCircuit: true, url: specifier };
    }
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const potential = path.resolve(path.dirname(parentPath), specifier);
    return { shortCircuit: true, url: pathToFileURL(potential).href };
  }
}

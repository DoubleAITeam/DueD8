import { execFile } from 'node:child_process';
import { spawn, type SpawnOptions } from 'node:child_process';
import { once } from 'node:events';

const WHICH_CACHE_TTL_MS = 60_000;
const whichCache = new Map<string, { value: string | null; timestamp: number }>();

function getWhichCommand(): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    return { command: 'where', args: [] };
  }
  return { command: 'which', args: [] };
}

export async function which(cmd: string): Promise<string | null> {
  const cached = whichCache.get(cmd);
  if (cached && Date.now() - cached.timestamp < WHICH_CACHE_TTL_MS) {
    return cached.value;
  }

  const { command, args } = getWhichCommand();

  const result: string | null = await new Promise((resolve) => {
    execFile(command, [...args, cmd], (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const firstLine = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve(firstLine ? firstLine.trim() : null);
    });
  });

  whichCache.set(cmd, { value: result, timestamp: Date.now() });
  return result;
}

export interface SpawnWithLimitsOptions extends SpawnOptions {
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  signal?: AbortSignal;
}

export interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const DEFAULT_MAX_STDOUT = 5 * 1024 * 1024;
const DEFAULT_MAX_STDERR = 5 * 1024 * 1024;

export async function spawnWithLimits(
  command: string,
  args: string[] = [],
  options: SpawnWithLimitsOptions = {}
): Promise<SpawnResult> {
  const {
    timeoutMs,
    maxStdoutBytes = DEFAULT_MAX_STDOUT,
    maxStderrBytes = DEFAULT_MAX_STDERR,
    signal,
    ...spawnOptions
  } = options;

  const controller = new AbortController();
  const signals: AbortSignal[] = [controller.signal];
  if (signal) {
    if (signal.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('Spawn aborted');
    }
    signal.addEventListener('abort', () => {
      controller.abort(signal.reason);
    });
    signals.push(signal);
  }

  let timeout: NodeJS.Timeout | null = null;
  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeout = setTimeout(() => {
      const error = new Error(`Process timed out after ${timeoutMs}ms`);
      (error as NodeJS.ErrnoException).code = 'ETIME';
      controller.abort(error);
    }, timeoutMs);
  }

  let stdoutBytes = 0;
  let stderrBytes = 0;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  function finalize(): { stdout: string; stderr: string } {
    return {
      stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
      stderr: Buffer.concat(stderrChunks).toString('utf-8')
    };
  }

  const child = spawn(command, args, {
    ...spawnOptions,
    signal: controller.signal,
    stdio: 'pipe'
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes > maxStdoutBytes) {
      const error = new Error('stdout limit exceeded');
      (error as NodeJS.ErrnoException).code = 'EOUTPUT';
      controller.abort(error);
      return;
    }
    stdoutChunks.push(chunk);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length;
    if (stderrBytes > maxStderrBytes) {
      const error = new Error('stderr limit exceeded');
      (error as NodeJS.ErrnoException).code = 'EOUTPUT';
      controller.abort(error);
      return;
    }
    stderrChunks.push(chunk);
  });

  const abortPromise = Promise.race(
    signals.map(async (sig) => {
      if (sig.aborted) {
        return sig.reason;
      }
      const [reason] = (await once(sig, 'abort')) as [unknown];
      return reason;
    })
  );

  const closePromise = new Promise<SpawnResult>((resolve, reject) => {
    child.once('error', (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      const { stdout, stderr } = finalize();
      (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stdout = stdout;
      (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stderr = stderr;
      reject(error);
    });

    child.once('close', (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({
        code,
        ...finalize()
      });
    });
  });

  const result = await Promise.race([closePromise, abortPromise.then((reason) => {
    const { stdout, stderr } = finalize();
    const error =
      reason instanceof Error
        ? reason
        : typeof reason === 'string'
          ? new Error(reason)
          : new Error('Process aborted');
    (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stdout = stdout;
    (error as NodeJS.ErrnoException & { stdout?: string; stderr?: string }).stderr = stderr;
    child.kill('SIGKILL');
    throw error;
  })]);

  return result as SpawnResult;
}

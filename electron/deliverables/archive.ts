import { app } from 'electron';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { promisify } from 'node:util';
import { deflateRaw } from 'node:zlib';

const deflateRawAsync = promisify(deflateRaw);

type ZipPlanEntry = {
  absolute: string;
  relative: string;
  mtime: Date;
};

type ZipResult = { ok: boolean; archivePath?: string; message?: string };

function resolveOutputsRoot(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'outputs');
}

function resolveArchivesRoot(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'archives');
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function ensureArchivesDirectory(): Promise<void> {
  const dir = resolveArchivesRoot();
  await fs.mkdir(dir, { recursive: true });
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join('/');
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      if ((c & 1) !== 0) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function toDosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time: dosTime & 0xffff, date: dosDate & 0xffff };
}

async function writeChunk(stream: fssync.WriteStream, chunk: Buffer): Promise<void> {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

async function buildZip(entries: ZipPlanEntry[], destination: string): Promise<void> {
  await ensureArchivesDirectory();
  const tmpPath = `${destination}.${process.pid}.${Date.now()}.tmp`;
  const writeStream = fssync.createWriteStream(tmpPath);

  const centralEntries: Buffer[] = [];
  let offset = 0;

  try {
    for (const entry of entries) {
      const raw = await fs.readFile(entry.absolute);
      const compressed = await deflateRawAsync(raw);
      const crc = crc32(raw);
      const fileNameBuffer = Buffer.from(toPosix(entry.relative), 'utf8');
      const { date, time } = toDosDateTime(entry.mtime);

      const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(8, 8);
      localHeader.writeUInt16LE(time, 10);
      localHeader.writeUInt16LE(date, 12);
      localHeader.writeUInt32LE(crc >>> 0, 14);
      localHeader.writeUInt32LE(compressed.length >>> 0, 18);
      localHeader.writeUInt32LE(raw.length >>> 0, 22);
      localHeader.writeUInt16LE(fileNameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);
      fileNameBuffer.copy(localHeader, 30);

      await writeChunk(writeStream, localHeader);
      await writeChunk(writeStream, Buffer.isBuffer(compressed) ? compressed : Buffer.from(compressed));

      const centralHeader = Buffer.alloc(46 + fileNameBuffer.length);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(8, 10);
      centralHeader.writeUInt16LE(time, 12);
      centralHeader.writeUInt16LE(date, 14);
      centralHeader.writeUInt32LE(crc >>> 0, 16);
      centralHeader.writeUInt32LE(compressed.length >>> 0, 20);
      centralHeader.writeUInt32LE(raw.length >>> 0, 24);
      centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset >>> 0, 42);
      fileNameBuffer.copy(centralHeader, 46);

      centralEntries.push(centralHeader);
      offset += localHeader.length + compressed.length;
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (const entry of centralEntries) {
      await writeChunk(writeStream, entry);
      centralSize += entry.length;
    }

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(entries.length, 8);
    endRecord.writeUInt16LE(entries.length, 10);
    endRecord.writeUInt32LE(centralSize >>> 0, 12);
    endRecord.writeUInt32LE(centralOffset >>> 0, 16);
    endRecord.writeUInt16LE(0, 20);

    await writeChunk(writeStream, endRecord);
  } catch (error) {
    writeStream.destroy(error instanceof Error ? error : undefined);
    throw error;
  } finally {
    writeStream.end();
    await finished(writeStream).catch(() => undefined);
  }

  try {
    await fs.rm(destination, { force: true });
  } catch {
    // ignore
  }

  await fs.rename(tmpPath, destination);
}

async function collectRunDirectories(runId: string): Promise<string[]> {
  const outputsRoot = resolveOutputsRoot();
  const directRunPath = path.join(outputsRoot, runId);
  const directories: string[] = [];
  if (await pathExists(directRunPath)) {
    directories.push(directRunPath);
  }

  try {
    const topLevel = await fs.readdir(outputsRoot, { withFileTypes: true });
    for (const entry of topLevel) {
      if (!entry.isDirectory()) {
        continue;
      }
      const artifactDir = path.join(outputsRoot, entry.name);
      if (entry.name === runId && !directories.includes(artifactDir)) {
        directories.push(artifactDir);
        continue;
      }
      try {
        const nested = await fs.readdir(artifactDir, { withFileTypes: true });
        for (const child of nested) {
          if (!child.isDirectory()) {
            continue;
          }
          if (child.name === runId) {
            directories.push(path.join(artifactDir, child.name));
          }
        }
      } catch {
        // ignore unreadable artifact directories
      }
    }
  } catch {
    // ignore if outputs directory missing
  }

  return Array.from(new Set(directories.map((dir) => path.resolve(dir))));
}

async function collectFilesForDirectories(directories: string[]): Promise<ZipPlanEntry[]> {
  const outputsRoot = resolveOutputsRoot();
  const files: ZipPlanEntry[] = [];

  for (const directory of directories) {
    const runRoot = await fs.stat(directory).then((stat) => (stat.isDirectory() ? directory : null)).catch(() => null);
    if (!runRoot) {
      continue;
    }
    const baseRelativeRaw = path.relative(outputsRoot, runRoot);
    const baseRelative = baseRelativeRaw && baseRelativeRaw !== '' ? baseRelativeRaw : path.basename(runRoot);

    const stack: Array<{ absolute: string; relative: string }> = [
      { absolute: runRoot, relative: baseRelative }
    ];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      let entries: Dirent[] = [];
      try {
        entries = await fs.readdir(current.absolute, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const absolute = path.join(current.absolute, entry.name);
        const relative = path.join(current.relative, entry.name);
        if (entry.isDirectory()) {
          stack.push({ absolute, relative });
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(absolute);
            files.push({ absolute, relative, mtime: stat.mtime });
          } catch {
            // ignore unreadable files
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  return files.filter((entry) => {
    if (seen.has(entry.absolute)) {
      return false;
    }
    seen.add(entry.absolute);
    return true;
  });
}

function resolveArchivePath(runId: string, suffix?: string): string {
  const safeSuffix = suffix ? `-${suffix}` : '';
  return path.join(resolveArchivesRoot(), `${runId}${safeSuffix}.zip`);
}

export async function zipRun(runId: string): Promise<ZipResult> {
  if (!runId) {
    return { ok: false, message: 'Run ID is required.' };
  }

  try {
    const directories = await collectRunDirectories(runId);
    if (directories.length === 0) {
      return { ok: false, message: 'No outputs found for run.' };
    }

    const files = await collectFilesForDirectories(directories);
    if (files.length === 0) {
      return { ok: false, message: 'Run outputs are empty.' };
    }

    const archivePath = resolveArchivePath(runId);
    await buildZip(files, archivePath);
    return { ok: true, archivePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create archive.';
    console.error('[deliverables:archive] zipRun failed', error);
    return { ok: false, message };
  }
}

function filterEntriesForArtifacts(
  entries: ZipPlanEntry[],
  runId: string,
  artifactIds: Set<string>
): ZipPlanEntry[] {
  const filtered: ZipPlanEntry[] = [];
  for (const entry of entries) {
    const posixRelative = toPosix(entry.relative);
    const segments = posixRelative.split('/');
    const fileName = segments[segments.length - 1] ?? '';
    const baseName = fileName.split('.')[0] ?? '';
    let include = false;
    for (const id of artifactIds) {
      if (segments.includes(id)) {
        include = true;
        break;
      }
      if (fileName === id || fileName.startsWith(`${id}.`) || fileName.startsWith(`${id}-`)) {
        include = true;
        break;
      }
      if (baseName === id) {
        include = true;
        break;
      }
    }

    if (!include && segments.length >= 2 && segments[0] === runId) {
      for (const id of artifactIds) {
        if (segments[1] && segments[1] === id) {
          include = true;
          break;
        }
      }
    }

    if (include) {
      filtered.push(entry);
    }
  }
  return filtered;
}

export async function zipArtifacts(artifactIds: string[], runId: string): Promise<ZipResult> {
  if (!runId) {
    return { ok: false, message: 'Run ID is required.' };
  }

  if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
    return zipRun(runId);
  }

  const uniqueArtifacts = new Set(artifactIds.filter((id) => typeof id === 'string' && id.trim().length > 0));
  if (uniqueArtifacts.size === 0) {
    return { ok: false, message: 'No artifact IDs provided.' };
  }

  try {
    const directories = await collectRunDirectories(runId);
    if (directories.length === 0) {
      return { ok: false, message: 'No outputs found for run.' };
    }
    const files = await collectFilesForDirectories(directories);
    const filtered = filterEntriesForArtifacts(files, runId, uniqueArtifacts);
    if (filtered.length === 0) {
      return { ok: false, message: 'Selected artifacts do not have local outputs.' };
    }

    const archivePath = resolveArchivePath(runId, 'selected');
    await buildZip(filtered, archivePath);
    return { ok: true, archivePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create archive.';
    console.error('[deliverables:archive] zipArtifacts failed', error);
    return { ok: false, message };
  }
}

export { type ZipResult };

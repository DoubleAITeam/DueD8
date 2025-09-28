import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ArtifactRecord,
  DeliverableJsonRecord,
  JobLogRecord,
  MaterialRecord
} from './types';

const DEFAULT_DATA_DIR = process.env.DELIVERABLES_V2_DATA_DIR || path.join(process.cwd(), '.deliverables');
const DATA_FILE = 'records.json';

type DataEnvelope = {
  artifacts: ArtifactRecord[];
  materials: MaterialRecord[];
  jobs: JobLogRecord[];
  jsonPayloads: DeliverableJsonRecord[];
};

async function ensureDir(target: string) {
  await fs.mkdir(target, { recursive: true });
}

async function readEnvelope(baseDir: string): Promise<DataEnvelope> {
  try {
    const raw = await fs.readFile(path.join(baseDir, DATA_FILE), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DataEnvelope>;
    return {
      artifacts: Array.isArray(parsed.artifacts) ? (parsed.artifacts as ArtifactRecord[]) : [],
      materials: Array.isArray(parsed.materials) ? (parsed.materials as MaterialRecord[]) : [],
      jobs: Array.isArray(parsed.jobs) ? (parsed.jobs as JobLogRecord[]) : [],
      jsonPayloads: Array.isArray(parsed.jsonPayloads)
        ? (parsed.jsonPayloads as DeliverableJsonRecord[])
        : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { artifacts: [], materials: [], jobs: [], jsonPayloads: [] };
    }
    throw error;
  }
}

async function writeEnvelope(baseDir: string, data: DataEnvelope) {
  await ensureDir(baseDir);
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(path.join(baseDir, DATA_FILE), payload, 'utf8');
}

function resolveDataDir(): string {
  if (process.env.DELIVERABLES_V2_DATA_DIR) {
    return process.env.DELIVERABLES_V2_DATA_DIR;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = eval('require')('electron') as typeof import('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'deliverables-v2');
    }
  } catch {
    // ignore, fall back to default dir
  }
  return DEFAULT_DATA_DIR;
}

export class DeliverablesDataStore {
  private baseDir: string;

  constructor(baseDir = resolveDataDir()) {
    this.baseDir = baseDir;
  }

  async createArtifact(record: ArtifactRecord): Promise<ArtifactRecord> {
    const data = await readEnvelope(this.baseDir);
    data.artifacts = data.artifacts.filter((item) => item.artifactId !== record.artifactId);
    data.artifacts.push(record);
    await writeEnvelope(this.baseDir, data);
    return record;
  }

  async updateArtifact(artifactId: string, patch: Partial<ArtifactRecord>): Promise<ArtifactRecord | null> {
    const data = await readEnvelope(this.baseDir);
    const existing = data.artifacts.find((item) => item.artifactId === artifactId);
    if (!existing) {
      return null;
    }
    const updated: ArtifactRecord = { ...existing, ...patch };
    data.artifacts = data.artifacts.map((item) => (item.artifactId === artifactId ? updated : item));
    await writeEnvelope(this.baseDir, data);
    return updated;
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord | null> {
    const data = await readEnvelope(this.baseDir);
    return data.artifacts.find((item) => item.artifactId === artifactId) ?? null;
  }

  async listArtifactsForAssignment(assignmentId: string): Promise<ArtifactRecord[]> {
    const data = await readEnvelope(this.baseDir);
    return data.artifacts.filter((item) => item.assignmentId === assignmentId);
  }

  async createMaterial(record: MaterialRecord): Promise<MaterialRecord> {
    const data = await readEnvelope(this.baseDir);
    data.materials = data.materials.filter((item) => item.materialId !== record.materialId);
    data.materials.push(record);
    await writeEnvelope(this.baseDir, data);
    return record;
  }

  async updateMaterial(materialId: string, patch: Partial<MaterialRecord>): Promise<MaterialRecord | null> {
    const data = await readEnvelope(this.baseDir);
    const existing = data.materials.find((item) => item.materialId === materialId);
    if (!existing) {
      return null;
    }
    const updated: MaterialRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    data.materials = data.materials.map((item) => (item.materialId === materialId ? updated : item));
    await writeEnvelope(this.baseDir, data);
    return updated;
  }

  async findMaterialByCanvasFile(assignmentId: string, canvasFileId: string): Promise<MaterialRecord | null> {
    const data = await readEnvelope(this.baseDir);
    return (
      data.materials.find(
        (item) => item.assignmentId === assignmentId && item.canvasFileId === canvasFileId
      ) ?? null
    );
  }

  async appendJobLog(record: JobLogRecord): Promise<JobLogRecord> {
    const data = await readEnvelope(this.baseDir);
    data.jobs.push(record);
    await writeEnvelope(this.baseDir, data);
    return record;
  }

  async updateJobLog(jobId: string, stage: JobLogRecord['stage'], patch: Partial<JobLogRecord>): Promise<JobLogRecord | null> {
    const data = await readEnvelope(this.baseDir);
    const index = data.jobs.findIndex((item) => item.jobId === jobId && item.stage === stage);
    if (index === -1) {
      return null;
    }
    const updated = { ...data.jobs[index], ...patch } satisfies JobLogRecord;
    data.jobs[index] = updated;
    await writeEnvelope(this.baseDir, data);
    return updated;
  }

  async createJsonRecord(record: DeliverableJsonRecord): Promise<DeliverableJsonRecord> {
    const data = await readEnvelope(this.baseDir);
    data.jsonPayloads.push(record);
    await writeEnvelope(this.baseDir, data);
    return record;
  }

  async getLatestJsonForAssignment(assignmentId: string): Promise<DeliverableJsonRecord | null> {
    const data = await readEnvelope(this.baseDir);
    const candidates = data.jsonPayloads
      .filter((item) => item.assignmentId === assignmentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return candidates[0] ?? null;
  }
}

export function createDefaultStore() {
  return new DeliverablesDataStore();
}

export function createJobId(prefix = 'job') {
  return `${prefix}-${randomUUID()}`;
}

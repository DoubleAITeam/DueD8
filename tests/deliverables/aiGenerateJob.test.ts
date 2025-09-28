import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { AiGenerateJob, AiModelClient, DeliverableJson } from '../../electron/deliverables/jobs/aiGenerateJob';
import { DeliverablesDataStore } from '../../electron/deliverables/dataStore';

class MissingKeyClient implements AiModelClient {
  async generateDeliverable(): Promise<DeliverableJson> {
    return {
      title: 'Invalid payload',
      assignment_id: 'assignment-1',
      sections: [],
      citations: [],
      metadata: { course: 'Test', due_at_iso: new Date().toISOString() }
    } as unknown as DeliverableJson;
  }
}

async function createStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deliverables-ai-'));
  return new DeliverablesDataStore(dir);
}

describe('AiGenerateJob', () => {
  it('rejects payloads missing required keys with GEN_SCHEMA_FAIL', async () => {
    const store = await createStore();
    const job = new AiGenerateJob(store, new MissingKeyClient());
    await expect(
      job.execute({ assignmentId: 'assignment-1', prompt: 'demo', materials: [] })
    ).rejects.toMatchObject({ code: 'GEN_SCHEMA_FAIL' });
  });
});

import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { DeliverablesDataStore } from '../../electron/deliverables/dataStore';
import { LocalObjectStorageAdapter } from '../../electron/deliverables/storageAdapter';
import { RenderArtifactsJob } from '../../electron/deliverables/jobs/renderArtifactsJob';
import type { DeliverableJson } from '../../electron/deliverables/jobs/aiGenerateJob';

const sampleDeliverable: DeliverableJson = {
  title: 'Integration Deliverable',
  assignment_id: 'integration-assignment',
  summary:
    'This integration test ensures the rendering pipeline produces viable DOCX and PDF artifacts that exceed size and structural thresholds for validation.',
  sections: [
    {
      heading: 'Approach',
      body_markdown:
        'Describe the methodology for transforming structured JSON into canonical deliverables, emphasising repeatability and styling consistency.'
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      heading: `Detail ${index + 1}`,
      body_markdown:
        'Extended elaboration with specific evidence, timelines, and grading cues ensures the output remains substantial for validation checks.'
    }))
  ],
  citations: [{ label: 'Instructor Note', url: 'https://example.com/instructor-note' }],
  metadata: { course: 'Integration Testing', due_at_iso: new Date().toISOString() }
};

async function createHarness() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deliverables-render-'));
  const store = new DeliverablesDataStore(dir);
  const storage = new LocalObjectStorageAdapter(path.join(dir, 'objects'));
  return { store, storage };
}

describe('RenderArtifactsJob integration', () => {
  it('renders DOCX and PDF with expected metadata', async () => {
    const { store, storage } = await createHarness();
    const job = new RenderArtifactsJob(store, storage);
    const { docx, pdf } = await job.execute({
      assignmentId: sampleDeliverable.assignment_id,
      artifactGroupId: 'integration-group',
      payload: sampleDeliverable
    });

    expect(docx.paragraphCount).toBeGreaterThanOrEqual(6);
    expect(docx.bytes).toBeGreaterThan(10 * 1024 - 512); // allow small variance
    expect(pdf.pageCount ?? 0).toBeGreaterThanOrEqual(1);
    expect(pdf.bytes).toBeGreaterThan(8 * 1024 - 512);
  });
});

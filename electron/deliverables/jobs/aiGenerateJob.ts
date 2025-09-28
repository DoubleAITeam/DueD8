import { randomUUID } from 'node:crypto';
import Ajv, { JSONSchemaType } from 'ajv';
import { DeliverablesDataStore } from '../dataStore';
import { createDeliverableJsonRecord, JobLogRecord } from '../types';
import { computeSha256 } from '../storageAdapter';
import { mainError } from '../../logger';

export type DeliverableSection = { heading: string; body_markdown: string };
export type DeliverableCitation = { label: string; url: string };

export type DeliverableJson = {
  title: string;
  assignment_id: string;
  summary: string;
  sections: DeliverableSection[];
  citations: DeliverableCitation[];
  metadata: {
    course: string;
    due_at_iso: string;
  };
};

export type AiGenerateJobInput = {
  assignmentId: string;
  prompt: string;
  materials: Array<{ filename: string; sha256: string }>;
};

export interface AiModelClient {
  generateDeliverable(payload: {
    prompt: string;
    assignmentId: string;
    materials: Array<{ filename: string; sha256: string }>;
  }): Promise<DeliverableJson>;
}

const schema: JSONSchemaType<DeliverableJson> = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    assignment_id: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          body_markdown: { type: 'string' }
        },
        required: ['heading', 'body_markdown'],
        additionalProperties: false
      },
      minItems: 1
    },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          url: { type: 'string' }
        },
        required: ['label', 'url'],
        additionalProperties: false
      }
    },
    metadata: {
      type: 'object',
      properties: {
        course: { type: 'string' },
        due_at_iso: { type: 'string' }
      },
      required: ['course', 'due_at_iso'],
      additionalProperties: false
    }
  },
  required: ['title', 'assignment_id', 'summary', 'sections', 'citations', 'metadata'],
  additionalProperties: false
};

const ajv = new Ajv({ allErrors: true });
const validateDeliverable = ajv.compile(schema);

export class AiGenerateJob {
  private store: DeliverablesDataStore;
  private client: AiModelClient;

  constructor(store: DeliverablesDataStore, client: AiModelClient) {
    this.store = store;
    this.client = client;
  }

  async execute(input: AiGenerateJobInput) {
    const jobId = `generate-${randomUUID()}`;
    const log: JobLogRecord = {
      jobId,
      stage: 'generate',
      message: 'Starting AI generation',
      startedAt: new Date().toISOString(),
      finishedAt: null
    };
    await this.store.appendJobLog(log);

    const payload = await this.client.generateDeliverable({
      assignmentId: input.assignmentId,
      materials: input.materials,
      prompt: input.prompt
    });

    const valid = validateDeliverable(payload);
    if (!valid) {
      const errorMessage = ajv.errorsText(validateDeliverable.errors);
      await this.store.appendJobLog({
        jobId,
        stage: 'failed',
        message: `Schema validation failed: ${errorMessage}`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      });
      const err = new Error(errorMessage);
      (err as Error & { code?: string }).code = 'GEN_SCHEMA_FAIL';
      throw err;
    }

    const artifactGroupId = randomUUID();
    const sha256 = computeSha256(Buffer.from(JSON.stringify(payload)));
    await this.store.createJsonRecord(
      createDeliverableJsonRecord({
        assignmentId: input.assignmentId,
        artifactGroupId,
        payload,
        sha256
      })
    );

    await this.store.updateJobLog(jobId, 'generate', {
      finishedAt: new Date().toISOString(),
      message: 'AI generation completed'
    });

    await this.store.appendJobLog({
      jobId,
      stage: 'done',
      message: 'Generation job finished',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });

    return { payload, artifactGroupId };
  }
}

export class DemoAiModelClient implements AiModelClient {
  async generateDeliverable(params: {
    prompt: string;
    assignmentId: string;
    materials: Array<{ filename: string; sha256: string }>;
  }): Promise<DeliverableJson> {
    const now = new Date().toISOString();
    const materialLines = params.materials
      .map(
        (item, index) =>
          `${index + 1}. ${item.filename} — hashed reference ${item.sha256.slice(0, 16)}. Summarise the main intent, actionable tasks, and any referenced rubrics before drafting.`
      )
      .join('\n');

    return {
      title: 'DueD8 Deliverable Draft',
      assignment_id: params.assignmentId,
      summary: `Auto-generated deliverable based on ${params.materials.length} material(s). This draft emphasises due dates, required deliverables, and instructor expectations captured in the Canvas sources so students receive a ready-to-submit outline. ${
        params.prompt
      }`,
      sections: [
        {
          heading: 'Overview',
          body_markdown:
            `Prompt summary:\n\n${params.prompt}\n\nThis section establishes the assignment goal, contextual background, and evaluation criteria inferred from the provided materials.`
        },
        {
          heading: 'Key Points from Materials',
          body_markdown: `${materialLines}\n\nFor each item, identify the submission format, grading emphasis, and any cited resources students must consult.`
        },
        {
          heading: 'Recommended Approach',
          body_markdown:
            'Lay out a recommended workflow: gather instructor context, draft high-level outline, write supporting evidence, and proofread against the rubric. Highlight risk areas and quality checks before submission.'
        }
      ],
      citations: params.materials.map((item, index) => ({
        label: `Source ${index + 1}`,
        url: `https://canvas.example.com/file/${item.sha256.slice(0, 8)}`
      })),
      metadata: {
        course: 'Demo Course',
        due_at_iso: now
      }
    } satisfies DeliverableJson;
  }
}

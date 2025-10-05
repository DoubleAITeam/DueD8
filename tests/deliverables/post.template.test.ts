import { describe, expect, it } from 'vitest';
import { applyTemplate } from '../../electron/deliverables/postprocess/template';
import type { CourseContext } from '../../electron/deliverables/postprocess/types';
import type { DeliverableJobResult } from '../../electron/deliverables/types';

const baseResult: DeliverableJobResult = {
  id: 'artifact-01',
  success: true,
  adapterId: 'copy-pdf',
  type: 'pdf'
};

const context: CourseContext = {
  courseId: 'IT/214-007',
  assignmentId: 'P3',
  courseName: 'Database Systems',
  dueDateIso: '2024-05-01',
  meta: {
    section: 'A',
    cohort: 3,
    honors: true
  }
};

describe('postprocess template', () => {
  it('replaces tokens with sanitized values', () => {
    const rendered = applyTemplate('{courseId}_{assignmentId}_{artifactId}', {
      result: baseResult,
      course: context,
      runId: 'run-123',
      timestamp: '2024-02-20T15:30:00Z'
    });

    expect(rendered).toBe('IT_214-007_P3_artifact-01');
  });

  it('falls back to meta values when available', () => {
    const rendered = applyTemplate('{section}-{cohort}-{honors}', {
      result: baseResult,
      course: context
    });

    expect(rendered).toBe('A-3-true');
  });

  it('omits unknown tokens', () => {
    const rendered = applyTemplate('{unknown}-{artifactId}', {
      result: baseResult,
      course: context
    });

    expect(rendered).toBe('-artifact-01');
  });

  it('includes run metadata when provided', () => {
    const rendered = applyTemplate('{runId}-{timestamp}', {
      result: baseResult,
      runId: 'run-xyz',
      timestamp: '2024-02-21T10:00:00Z'
    });

    expect(rendered).toBe('run-xyz-2024-02-21T10_00_00Z');
  });
});

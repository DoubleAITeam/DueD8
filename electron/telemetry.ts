import { mainLog } from './logger';

const downloadSuccessOnce = new Set<string>();

export type DeliverablesTraceStage = 'start' | 'completed' | 'failed';

export function logDeliverablesTrace(
  jobId: string,
  assignmentId: string,
  stage: DeliverablesTraceStage,
  extra?: Record<string, unknown>
) {
  mainLog('[telemetry]', {
    trace: 'deliverables_v2_pipeline',
    job_id: jobId,
    assignment_id: assignmentId,
    stage,
    ...extra
  });
}

export function logDeliverablesDownloadSuccessOnce(
  assignmentId: string,
  type: string,
  source: 'production' | 'demo'
) {
  const key = `${source}:${assignmentId}:${type}`;
  if (downloadSuccessOnce.has(key)) {
    return;
  }
  downloadSuccessOnce.add(key);
  mainLog('[telemetry]', {
    metric: 'deliverables_v2_download_success_total',
    assignment_id: assignmentId,
    type,
    source
  });
}

export function logDeliverablesBlocked(reason: string) {
  mainLog('[telemetry]', {
    metric: 'deliverables_v2_blocked_total',
    reason
  });
}

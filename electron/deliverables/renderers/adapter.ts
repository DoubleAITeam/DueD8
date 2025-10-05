import type { ArtifactInput, DeliverableJobResult } from '../types';

export interface AdapterHealth {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface RendererAdapter {
  id: string;
  handles: ('pdf' | 'docx' | 'html')[];
  health(): Promise<AdapterHealth>;
  render(args: {
    artifact: ArtifactInput;
    outDir: string;
    signal: AbortSignal;
    dryRun?: boolean;
  }): Promise<DeliverableJobResult>;
}


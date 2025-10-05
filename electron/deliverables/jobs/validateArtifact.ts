import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { getDeliverablesConfig } from '../config';
import type { ArtifactInput, ArtifactKind, DeliverableJobResult, ValidationError } from '../types';

const SUPPORTED_TYPES: ArtifactKind[] = ['pdf', 'docx', 'html'];

function resolveSizeLimit(): { bytes: number; limitMb: number } {
  const limitMb = getDeliverablesConfig().sizeCaps.maxArtifactMb;
  return { bytes: limitMb * 1024 * 1024, limitMb };
}

function buildFailureMessage(errors: ValidationError[]): string {
  const codes = errors.map((error) => error.code).join(', ');
  return `Validation failed (${codes})`;
}

export async function run(artifact?: ArtifactInput): Promise<DeliverableJobResult> {
  if (!artifact) {
    const message = 'No artifact provided for validation.';
    return {
      id: 'unknown-artifact',
      success: false,
      message,
      errors: [
        {
          code: 'MISSING_FILE',
          details: message
        }
      ]
    };
  }

  const errors: ValidationError[] = [];

  if (!SUPPORTED_TYPES.includes(artifact.type)) {
    errors.push({
      code: 'UNSUPPORTED_TYPE',
      details: `Unsupported artifact type: ${artifact.type}`
    });
  }

  let stats: Stats | null = null;
  try {
    stats = await fs.stat(artifact.srcPath);
  } catch (error) {
    errors.push({
      code: 'MISSING_FILE',
      details: `Artifact not found at path: ${artifact.srcPath}`
    });
  }

  if (stats) {
    if (stats.size === 0) {
      errors.push({
        code: 'EMPTY_FILE',
        details: 'Artifact file is empty.'
      });
    }

    const { bytes: limitBytes, limitMb } = resolveSizeLimit();
    if (stats.size > limitBytes) {
      errors.push({
        code: 'SIZE_LIMIT',
        details: `Artifact exceeds size limit of ${limitMb} MB.`
      });
    }
  }

  const success = errors.length === 0;

  return {
    id: artifact.id,
    success,
    message: success ? 'Validation passed.' : buildFailureMessage(errors),
    errors: success ? undefined : errors
  };
}

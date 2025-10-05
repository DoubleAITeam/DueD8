import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseArtifact } from '../../electron/deliverables/insights/parsers';

describe('insights pdf parser', () => {
  const tmpDir = path.join(os.tmpdir(), `insights-pdf-${Date.now()}`);
  const pdfPath = path.join(tmpDir, 'sample.pdf');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >> endobj
4 0 obj << /Length 74 >> stream
BT /F1 12 Tf 10 10 Td (ENG-150-105 Assignment P7) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000111 00000 n 
0000000201 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
280
%%EOF`;
    await fs.writeFile(pdfPath, pdf);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('scrapes text streams and counts pages', async () => {
    const result = await parseArtifact(pdfPath, 'pdf');
    expect(result.pageCount).toBe(1);
    expect(result.detectedCourseId).toBe('ENG-150-105');
    expect(result.detectedAssignmentId).toBe('P7');
    expect(result.warnings).not.toContain('No text extracted');
    expect(result.text).toContain('Assignment');
  });
});

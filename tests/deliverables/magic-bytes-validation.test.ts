import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { DeliverablesDataStore } from '../../electron/deliverables/dataStore';
import { LocalObjectStorageAdapter, detectMimeByMagic } from '../../electron/deliverables/storageAdapter';
import { RenderArtifactsJob } from '../../electron/deliverables/jobs/renderArtifactsJob';
import type { DeliverableJson } from '../../electron/deliverables/jobs/aiGenerateJob';

const sampleDeliverable: DeliverableJson = {
  title: 'Magic Bytes Validation Test',
  assignment_id: 'magic-bytes-test',
  summary: 'This test validates storage magic bytes and MIME detection for artifacts.',
  sections: [
    {
      heading: 'Introduction',
      body_markdown: 'This section provides comprehensive content for magic bytes validation testing.'
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      heading: `Section ${index + 1}`,
      body_markdown: `Extended content for section ${index + 1} with detailed explanations, examples, and comprehensive coverage to ensure the document meets all validation requirements for structure and content depth. This content is specifically designed to generate artifacts that exceed the minimum size thresholds.`
    }))
  ],
  citations: [{ label: 'Test Reference', url: 'https://example.com/test-ref' }],
  metadata: { course: 'Magic Bytes Validation', due_at_iso: new Date().toISOString() }
};

// Magic byte patterns for validation
const MAGIC_PATTERNS = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // ZIP signature (DOCX is ZIP-based)
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function validateMagicBytes(bytes: Uint8Array, expectedMime: string): { valid: boolean; reason: string } {
  const pattern = MAGIC_PATTERNS[expectedMime as keyof typeof MAGIC_PATTERNS];
  if (!pattern) {
    return { valid: false, reason: `No magic pattern defined for ${expectedMime}` };
  }
  
  const matches = pattern.every((expected, index) => bytes[index] === expected);
  return { valid: matches, reason: matches ? 'PASS' : 'Magic bytes do not match expected pattern' };
}

async function createTestHarness() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deliverables-magic-test-'));
  const store = new DeliverablesDataStore(dir);
  const storage = new LocalObjectStorageAdapter(path.join(dir, 'objects'));
  return { store, storage, dir };
}

async function createTestMaterial(storage: LocalObjectStorageAdapter) {
  // Create a minimal but valid PDF
  const pdfContent = Buffer.from([
    0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
    0x0A, 0x31, 0x20, 0x30, 0x20, 0x6F, 0x62, 0x6A, // \n1 0 obj
    0x0A, 0x3C, 0x3C, 0x0A, 0x2F, 0x54, 0x79, 0x70, // \n<<\n/Typ
    0x65, 0x20, 0x2F, 0x43, 0x61, 0x74, 0x61, 0x6C, // e /Catal
    0x6F, 0x67, 0x0A, 0x2F, 0x50, 0x61, 0x67, 0x65, // og\n/Page
    0x73, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x0A, // s 2 0 R\n
    0x3E, 0x3E, 0x0A, 0x65, 0x6E, 0x64, 0x6F, 0x62, // >>\nendob
    0x6A, 0x0A, // j\n
    ...Array(200).fill(0x20), // padding
    0x25, 0x25, 0x45, 0x4F, 0x46 // %%EOF
  ]);
  
  return await storage.putObject(pdfContent, 'pdf');
}

describe('Magic Bytes Validation', () => {
  it('validates storage magic bytes for all artifacts and materials', async () => {
    const { store, storage, dir } = await createTestHarness();
    
    try {
      // Create test material
      const materialResult = await createTestMaterial(storage);
      
      // Render artifacts
      const renderJob = new RenderArtifactsJob(store, storage);
      const { docx, pdf } = await renderJob.execute({
        assignmentId: sampleDeliverable.assignment_id,
        artifactGroupId: 'magic-test-group',
        payload: sampleDeliverable
      });
      
      // Collect items to validate
      const items = [
        {
          name: 'instructor_material',
          storageKey: materialResult.storageKey,
          sha256: materialResult.sha256,
          expectedMime: 'application/pdf',
          bytes: materialResult.bytes
        },
        {
          name: 'docx_artifact',
          storageKey: docx.storageKey,
          sha256: docx.sha256,
          expectedMime: docx.mime,
          bytes: docx.bytes
        },
        {
          name: 'pdf_artifact',
          storageKey: pdf.storageKey,
          sha256: pdf.sha256,
          expectedMime: pdf.mime,
          bytes: pdf.bytes
        }
      ];
      
      console.log('\n=== Storage Magic Bytes Validation ===\n');
      
      let hasFailures = false;
      
      for (const item of items) {
        // Read the actual file
        const fileBuffer = await storage.getObject(item.storageKey);
        const magicBytes = new Uint8Array(fileBuffer.slice(0, 8));
        const detectedMime = detectMimeByMagic(magicBytes);
        
        // Validate magic bytes
        const validation = validateMagicBytes(magicBytes, item.expectedMime);
        
        console.log(`${item.name.toUpperCase()}:`);
        console.log(`  storage_key: ${item.storageKey}`);
        console.log(`  sha256: ${item.sha256}`);
        console.log(`  magic_bytes: ${bytesToHex(magicBytes)}`);
        console.log(`  expected_mime: ${item.expectedMime}`);
        console.log(`  detected_mime: ${detectedMime || 'unknown'}`);
        console.log(`  validation: ${validation.valid ? 'PASS' : 'FAIL'}`);
        
        if (!validation.valid) {
          console.log(`  failure_reason: ${validation.reason}`);
          hasFailures = true;
        }
        
        // Additional validation: detected MIME should be compatible
        if (detectedMime) {
          // DOCX files are ZIP-based, so they may be detected as ZIP - this is acceptable
          const isDocxAsZip = item.expectedMime.includes('wordprocessingml') && detectedMime === 'application/zip';
          const exactMatch = detectedMime === item.expectedMime;
          
          if (!exactMatch && !isDocxAsZip) {
            console.log(`  mime_mismatch: detected ${detectedMime} but expected ${item.expectedMime}`);
            hasFailures = true;
          }
        }
        
        console.log('');
        
        // Assert expectations for the test framework
        expect(validation.valid, `Magic bytes validation failed for ${item.name}: ${validation.reason}`).toBe(true);
        expect(item.storageKey).toBeTruthy();
        expect(item.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(item.bytes).toBeGreaterThan(0);
      }
      
      if (hasFailures) {
        throw new Error('Magic byte validation failures detected');
      }
      
      console.log('✅ All magic bytes validation PASSED\n');
      
    } finally {
      // Cleanup
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});





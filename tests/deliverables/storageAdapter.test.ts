import { describe, expect, it } from 'vitest';
import { detectMimeByMagic } from '../../electron/deliverables/storageAdapter';

describe('detectMimeByMagic', () => {
  it('detects DOCX magic header', () => {
    const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(detectMimeByMagic(buffer)).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('detects PDF magic header', () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(detectMimeByMagic(buffer)).toBe('application/pdf');
  });

  it('returns null for unknown bytes', () => {
    const buffer = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    expect(detectMimeByMagic(buffer)).toBeNull();
  });
});

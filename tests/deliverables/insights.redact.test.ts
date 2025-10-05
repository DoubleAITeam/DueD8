import { describe, expect, it } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import { getRedactionPatterns, maybeRedactText, redactText } from '../../electron/deliverables/insights/redact';

describe('insights redaction utilities', () => {
  it('masks emails, phone numbers, student ids, and labelled names', () => {
    const sample = 'Contact Name: Jane Doe via jane@example.edu or 555-123-4567. Student ID 1234567.';
    const { text, redacted } = redactText(sample);
    expect(redacted).toBe(true);
    expect(text).not.toContain('jane@example.edu');
    expect(text).not.toContain('555-123-4567');
    expect(text).not.toContain('1234567');
    expect(text).toContain('Name: [redacted name]');
  });

  it('respects redaction flag when disabled', () => {
    const originalFlag = process.env.DELIV_INSIGHTS_REDACT;
    process.env.DELIV_INSIGHTS_REDACT = '0';
    resetDeliverablesConfigCache();
    const result = maybeRedactText('Student: Ada Lovelace');
    expect(result.text).toBe('Student: Ada Lovelace');
    expect(result.redacted).toBe(false);
    process.env.DELIV_INSIGHTS_REDACT = originalFlag;
    resetDeliverablesConfigCache();
  });

  it('exposes redacted pattern descriptions', () => {
    const patterns = getRedactionPatterns();
    expect(patterns).toContain('Emails');
    expect(patterns).toContain('Phone numbers');
  });
});

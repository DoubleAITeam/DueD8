import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../electron/deliverables/renderers/staticHtml';

describe('static html adapter sanitization', () => {
  it('removes script tags and inline handlers', () => {
    const html = `
      <html>
        <body onload="evil()">
          <h1 onclick='alert("bad")'>Hello</h1>
          <p data-id="123">Content</p>
          <script>console.log('bad');</script>
        </body>
      </html>
    `;

    const sanitized = sanitizeHtml(html);

    expect(sanitized).not.toMatch(/<script/i);
    expect(sanitized).not.toMatch(/onload=/i);
    expect(sanitized).not.toMatch(/onclick=/i);
    expect(sanitized).toMatch(/Content/);
  });
});


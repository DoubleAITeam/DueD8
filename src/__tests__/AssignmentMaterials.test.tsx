import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AssignmentMaterials from '../renderer/components/AssignmentMaterials';

describe('AssignmentMaterials', () => {
  it('does not render text download links for parsed context entries', () => {
    render(
      <AssignmentMaterials
        attachments={[
          {
            id: 'file-1',
            name: 'instructions.pdf',
            url: 'https://example.com/instructions.pdf',
            contentType: 'application/pdf'
          }
        ]}
        canvasLink={null}
        description={null}
        contextEntries={[
          {
            fileName: 'syllabus.pdf',
            content: 'Detailed syllabus text that should be shown as preview only.',
            uploadedAt: Date.now(),
            source: 'instructor'
          }
        ]}
      />
    );

    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.endsWith('.txt')).toBe(false);
    }

    expect(screen.getByText(/Detailed syllabus text/)).toBeInTheDocument();
  });
});

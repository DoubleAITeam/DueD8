import React from 'react';
import type { AICitation } from '../../../shared/types/ai';

type Props = {
  citations: AICitation[];
};

export function CitationList({ citations }: Props): JSX.Element | null {
  if (!citations?.length) {
    return null;
  }
  return (
    <div className="chatbot-citations" role="note">
      {citations.map((citation, index) => (
        <span key={`${citation.source}-${index}`} className="chatbot-citation-pill">
          {index + 1}. {citation.title}
        </span>
      ))}
    </div>
  );
}

export default CitationList;

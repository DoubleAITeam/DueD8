import React, { useMemo } from 'react';
import type { AssignmentContextEntry } from '../state/store';
import { featureFlags } from '../../shared/featureFlags';

type AttachmentLink = { id: string; name: string; url: string; contentType: string | null };

type Props = {
  attachments: AttachmentLink[];
  canvasLink: string | null;
  description?: string | null;
  contextEntries?: AssignmentContextEntry[];
};

function safeDownloadName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function extractHtmlParagraphs(html: string | null | undefined) {
  if (!html) return [] as string[];

  let textContent = '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      textContent = doc.body?.textContent ?? '';
    } else {
      textContent = html;
    }
  } catch (error) {
    textContent = html;
  }

  return textContent
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length);
}

export default function AssignmentMaterials({ attachments, canvasLink, description, contextEntries }: Props) {
  const allowAttachments = featureFlags.assignmentSourceLinks;
  const descriptionParagraphs = useMemo(() => extractHtmlParagraphs(description), [description]);

  const primaryAttachment = allowAttachments ? attachments[0] ?? null : null;
  const additionalAttachments = allowAttachments ? attachments.slice(1) : [];

  if (
    !primaryAttachment &&
    !additionalAttachments.length &&
    !descriptionParagraphs.length &&
    !(contextEntries && contextEntries.length) &&
    !canvasLink
  ) {
    return null;
  }

  return (
    <div
      style={{
        border: '1px solid var(--surface-border)',
        borderRadius: 16,
        padding: 20,
        background: 'rgba(255,255,255,0.85)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>Canvas materials</strong>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Download files and review instructions imported from Canvas.
        </span>
      </div>

      {primaryAttachment ? (
        <a
          key={primaryAttachment.id}
          href={primaryAttachment.url}
          download={safeDownloadName(primaryAttachment.name || 'canvas-attachment')}
          rel="noreferrer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            textDecoration: 'none',
            border: '1px solid var(--surface-border)',
            borderRadius: 12,
            padding: '12px 16px',
            background: '#fff'
          }}
        >
          <span style={{ fontWeight: 600 }}>Original assignment file</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{primaryAttachment.name}</span>
        </a>
      ) : null}

      {additionalAttachments.length ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {additionalAttachments.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={attachment.url}
                download={safeDownloadName(attachment.name || 'canvas-attachment')}
                rel="noreferrer"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                {attachment.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {contextEntries && contextEntries.length ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'rgba(109, 40, 217, 0.06)',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(109, 40, 217, 0.16)'
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Parsed Canvas attachments</span>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {contextEntries.map((entry) => (
              <li key={`${entry.fileName}-${entry.uploadedAt}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{entry.fileName}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {entry.content.length > 160 ? `${entry.content.slice(0, 160)}…` : entry.content}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {descriptionParagraphs.length ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1.55
          }}
        >
          {descriptionParagraphs.map((paragraph, index) => (
            <p key={index} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {canvasLink ? (
        <a
          href={canvasLink}
          target="_blank"
          rel="noreferrer"
          style={{
            alignSelf: 'flex-start',
            textDecoration: 'none',
            color: 'var(--accent)',
            fontWeight: 600
          }}
        >
          View on Canvas
        </a>
      ) : null}
    </div>
  );
}

export type { AttachmentLink };

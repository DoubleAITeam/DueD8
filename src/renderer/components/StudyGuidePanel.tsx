import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createSolutionArtifact } from '../utils/assignmentSolution';
import type { StudyGuidePlan } from '../utils/studyGuide';
import { convertGuideToMarkdown, markdownToPlainText } from '../utils/studyGuide';

type GuideStatus = 'idle' | 'generating' | 'ready' | 'error';

type Progress = {
  current: number;
  total: number;
  label: string;
};

type StudyGuidePanelProps = {
  plan: StudyGuidePlan | null;
  status: GuideStatus;
  progress: Progress | null;
  onGenerate: () => void;
  canGenerate: boolean;
  error?: string | null;
};

type CollapsedState = Record<string, boolean>;

const VIRTUALIZATION_THRESHOLD = 10000;
const OVERSCAN = 800;

type VirtualChunk = {
  top: number;
  height: number;
  html: string;
};

type MarkdownBlockProps = {
  markdown: string;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(text: string) {
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return formatted;
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    let line = lines[index];
    if (!line || !line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].startsWith('```')) {
        index += 1;
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.trim().startsWith('<details')) {
      const detailLines: string[] = [line];
      index += 1;
      while (index < lines.length && !lines[index].includes('</details>')) {
        detailLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        detailLines.push(lines[index]);
        index += 1;
      }
      blocks.push(detailLines.join('\n'));
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      const level = Math.min(line.match(/^#+/)?.[0].length ?? 1, 5);
      const text = line.replace(/^#{1,6}\s+/, '');
      blocks.push(`<h${level + 1}>${formatInline(text)}</h${level + 1}>`);
      index += 1;
      continue;
    }
    if (/^(\-|\*|\+|•)\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^(\-|\*|\+|•)\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^(\-|\*|\+|•)\s+/, '');
        items.push(`<li>${formatInline(itemText)}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^\d+\.\s+/, '');
        items.push(`<li>${formatInline(itemText)}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      const quoteHtml = formatInline(quoteLines.join(' '));
      blocks.push(`<blockquote>${quoteHtml}</blockquote>`);
      continue;
    }
    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraphHtml = formatInline(paragraphLines.join(' '));
    blocks.push(`<p>${paragraphHtml}</p>`);
  }
  return blocks.join('');
}

function chunkMarkdown(markdown: string) {
  const parts: string[] = [];
  let buffer: string[] = [];
  const lines = markdown.split('\n');
  const flush = () => {
    if (buffer.length) {
      parts.push(buffer.join('\n'));
      buffer = [];
    }
  };
  for (const line of lines) {
    buffer.push(line);
    if (!line.trim()) {
      flush();
    }
  }
  flush();
  return parts.map((part) => part.trim()).filter(Boolean);
}

function MarkdownBlock({ markdown }: MarkdownBlockProps) {
  const [mode, setMode] = useState<'full' | 'virtual'>('full');
  const [chunks, setChunks] = useState<string[]>(() => chunkMarkdown(markdown));
  const [virtualChunks, setVirtualChunks] = useState<VirtualChunk[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const html = useMemo(() => markdownToHtml(markdown), [markdown]);
  const chunkHtml = useMemo(() => chunks.map((part) => markdownToHtml(part)), [chunks]);

  useEffect(() => {
    setChunks(chunkMarkdown(markdown));
    setMode('full');
  }, [markdown]);

  useEffect(() => {
    if (mode !== 'full') {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      if (!measureRef.current) {
        return;
      }
      const height = measureRef.current.scrollHeight;
      if (height > VIRTUALIZATION_THRESHOLD) {
        setMode('virtual');
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [chunks, mode]);

  useEffect(() => {
    if (mode !== 'virtual') {
      return;
    }
    if (!measureRef.current) {
      return;
    }
    const nodes = Array.from(measureRef.current.children) as HTMLElement[];
    const computed: VirtualChunk[] = [];
    let offset = 0;
    nodes.forEach((node, index) => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      const chunk = chunkHtml[index] ?? '';
      computed.push({ top: offset, height, html: chunk });
      offset += height;
    });
    setVirtualChunks(computed);
    setContainerHeight(offset);
  }, [mode, chunkHtml]);

  useEffect(() => {
    if (mode !== 'virtual') {
      return;
    }
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const handleScroll = () => {
      setScrollTop(element.scrollTop);
    };
    element.addEventListener('scroll', handleScroll);
    setScrollTop(element.scrollTop);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [mode]);

  if (mode === 'full') {
    return (
      <>
        <div className="study-guide-markdown" dangerouslySetInnerHTML={{ __html: html }} />
        <div
          ref={measureRef}
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </>
    );
  }

  const visibleChunks = useMemo(() => {
    if (!virtualChunks.length) {
      return [];
    }
    const viewportTop = Math.max(0, scrollTop - OVERSCAN);
    const viewportBottom = scrollTop + (containerRef.current?.clientHeight ?? 0) + OVERSCAN;
    return virtualChunks.filter((chunk) => {
      const chunkBottom = chunk.top + chunk.height;
      return chunkBottom >= viewportTop && chunk.top <= viewportBottom;
    });
  }, [virtualChunks, scrollTop]);

  return (
    <div className="study-guide-virtual-wrapper" ref={containerRef}>
      <div style={{ position: 'relative', height: containerHeight }}>
        {visibleChunks.map((chunk) => (
          <div key={`${chunk.top}-${chunk.height}`} style={{ position: 'absolute', left: 0, right: 0, top: chunk.top }}>
            <div className="study-guide-markdown" dangerouslySetInnerHTML={{ __html: chunk.html }} />
          </div>
        ))}
      </div>
      <div
        ref={measureRef}
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden' }}
      >
        {chunkHtml.map((chunk, index) => (
          <div key={`measure-${index}`} dangerouslySetInnerHTML={{ __html: chunk }} />
        ))}
      </div>
    </div>
  );
}

export default function StudyGuidePanel({
  plan,
  status,
  progress,
  onGenerate,
  canGenerate,
  error
}: StudyGuidePanelProps) {
  const [collapsed, setCollapsed] = useState<CollapsedState>({});
  const [markdown, setMarkdown] = useState<string>('');

  useEffect(() => {
    if (!plan) {
      setCollapsed({});
      setMarkdown('');
      return;
    }
    setCollapsed((previous) => {
      const next: CollapsedState = {};
      plan.sections.forEach((section) => {
        next[section.id] = previous[section.id] ?? false;
      });
      return next;
    });
    const fullMarkdown = convertGuideToMarkdown(plan);
    setMarkdown(fullMarkdown);
  }, [plan]);

  const plainText = useMemo(() => markdownToPlainText(markdown), [markdown]);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setCollapsed((prev) => {
      if (!plan) return prev;
      const next: CollapsedState = {};
      plan.sections.forEach((section) => {
        next[section.id] = false;
      });
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsed((prev) => {
      if (!plan) return prev;
      const next: CollapsedState = {};
      plan.sections.forEach((section) => {
        next[section.id] = true;
      });
      return next;
    });
  };

  const copyAll = async () => {
    if (!markdown.trim().length) {
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
    } catch (copyError) {
      console.warn('Copy failed', copyError);
    }
  };

  const download = async (extension: 'pdf' | 'docx') => {
    if (!markdown.trim().length) {
      return;
    }
    const artifact = await createSolutionArtifact({ extension, content: plainText });
    const blobUrl = URL.createObjectURL(artifact.blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${plan?.heading.replace(/[^a-zA-Z0-9._-]+/g, '-') ?? 'StudyCoachGuide'}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const printGuide = () => {
    window.print();
  };

  const tocItems = useMemo(() => {
    if (!plan) {
      return [];
    }
    return [{ id: 'overview', title: 'Overview' }, ...plan.sections.map((section) => ({ id: section.id, title: section.title }))];
  }, [plan]);

  return (
    <div className="study-guide-container">
      <div className="study-guide-actions">
        <div className="study-guide-buttons">
          <button type="button" onClick={copyAll} disabled={!markdown.trim().length}>
            Copy all
          </button>
          <button type="button" onClick={() => download('docx')} disabled={!markdown.trim().length}>
            Download as DOCX
          </button>
          <button type="button" onClick={() => download('pdf')} disabled={!markdown.trim().length}>
            Download as PDF
          </button>
          <button type="button" onClick={printGuide} disabled={!markdown.trim().length}>
            Print
          </button>
        </div>
        <div className="study-guide-expand-controls">
          <button type="button" onClick={expandAll} disabled={!plan}>
            Expand all
          </button>
          <button type="button" onClick={collapseAll} disabled={!plan}>
            Collapse all
          </button>
        </div>
      </div>
      <div className="study-guide-grid">
        <div className="study-guide-main">
          {!plan ? (
            <div className="study-guide-empty">
              <p>
                Generate a personalised walkthrough with our Study Coach. It blends instructor materials and your uploads into a
                single plan.
              </p>
              <button type="button" onClick={onGenerate} disabled={!canGenerate || status === 'generating'}>
                {status === 'generating' ? 'Generating…' : 'Generate guide'}
              </button>
              {error ? <div className="study-guide-error">{error}</div> : null}
            </div>
          ) : (
            <>
              <header id="overview" className="study-guide-header">
                <h2>{plan.heading}</h2>
                <MarkdownBlock markdown={plan.overview} />
                <div className="study-guide-utility">
                  <button type="button" onClick={onGenerate} disabled={!canGenerate || status === 'generating'}>
                    {status === 'generating' ? 'Regenerating…' : 'Regenerate guide'}
                  </button>
                  {status === 'generating' && progress ? (
                    <div className="study-guide-progress">
                      <span>Generating…</span>
                      <progress value={progress.current} max={progress.total} />
                      <span className="study-guide-progress-label">{progress.label}</span>
                    </div>
                  ) : null}
                  {error ? <div className="study-guide-error">{error}</div> : null}
                </div>
              </header>
              <div className="study-guide-sections">
                {plan.sections.map((section) => {
                  const isCollapsed = collapsed[section.id];
                  return (
                    <section key={section.id} id={section.id} className="study-guide-section">
                      <div className="study-guide-section-header">
                        <h3>{section.title}</h3>
                        <button type="button" onClick={() => toggleSection(section.id)}>
                          {isCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                      </div>
                      {!isCollapsed ? <MarkdownBlock markdown={section.body} /> : null}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <aside className="study-guide-toc">
          <div className="study-guide-toc-inner">
            <strong>On this page</strong>
            <ul>
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

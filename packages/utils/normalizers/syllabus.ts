import { JSDOM } from "jsdom";
import JSZip from "jszip";
import { TextDecoder, TextEncoder } from "util";
import type { SyllabusChunk, SyllabusSection } from "../../core/db/schema";

export type NormalizedChunk = Omit<SyllabusChunk, "id" | "courseId">;

export type SyllabusInput = {
  data: string | Uint8Array | ArrayBuffer;
  mimeType?: string;
  fileName?: string;
};

export async function normalizeSyllabus(input: SyllabusInput): Promise<NormalizedChunk[]> {
  const text = await extractText(input);
  const doc = parseHtml(text);
  const sections = extractSections(doc, text);

  return sections.map((section) => ({
    heading: section.heading,
    text: section.text,
    dateISO: section.dateISO,
    section: section.section,
    tokens: estimateTokens(section.text),
  }));
}

async function extractText(input: SyllabusInput) {
  const mime = (input.mimeType ?? guessMimeFromName(input.fileName)).toLowerCase();

  if (mime.includes("html")) {
    return typeof input.data === "string" ? input.data : bufferToString(input.data);
  }

  if (mime.includes("xml")) {
    return bufferToString(input.data);
  }

  if (mime.includes("docx")) {
    return extractDocxText(input.data);
  }

  if (mime.includes("pdf")) {
    return extractPdfText(input.data);
  }

  return bufferToString(input.data);
}

function guessMimeFromName(fileName?: string) {
  if (!fileName) return "text/plain";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xml")) return "application/xml";
  return "text/plain";
}

async function extractDocxText(raw: SyllabusInput["data"]) {
  const buffer = toUint8Array(raw);
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) {
    return "";
  }

  return doc
    .replace(/<w:p [^>]*>/g, "\n")
    .replace(/<w:tbl[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdfText(raw: SyllabusInput["data"]) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.js");
  const data = toUint8Array(raw);
  const pdf = await getDocument({ data }).promise;
  const pageTexts = [] as string[];
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const textItems = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    pageTexts.push(textItems.join(" "));
  }

  return pageTexts.join("\n");
}

function parseHtml(content: string) {
  if (!content.trim().startsWith("<")) {
    return new JSDOM(`<article>${escapeHtml(content)}</article>`).window.document;
  }

  return new JSDOM(content).window.document;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ExtractedSection = {
  heading: string | null;
  text: string;
  dateISO: string | null;
  section: SyllabusSection;
};

function extractSections(doc: Document, fallbackText: string): ExtractedSection[] {
  const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  if (!headings.length) {
    const normalized = normalizeWhitespace(fallbackText);
    return [
      {
        heading: null,
        text: normalized,
        dateISO: extractDate(normalized),
        section: inferSection(null, normalized),
      },
    ];
  }

  const headingSet = new Set(headings);
  const sections: ExtractedSection[] = [];

  for (const heading of headings) {
    const sectionText = collectFollowingText(heading, headingSet);
    const normalizedText = normalizeWhitespace(sectionText);
    if (!normalizedText) continue;

    const headingText = normalizeWhitespace(heading.textContent ?? "");
    sections.push({
      heading: headingText || null,
      text: normalizedText,
      dateISO: extractDate(`${headingText} ${normalizedText}`),
      section: inferSection(headingText, normalizedText),
    });
  }

  return sections;
}

function collectFollowingText(heading: Element, headingSet: Set<Element>) {
  const parts: string[] = [];
  let node: Node | null = heading.nextSibling;
  const view = heading.ownerDocument?.defaultView;
  const ElementCtor = view?.Element;

  while (node) {
    if (ElementCtor && node instanceof ElementCtor && headingSet.has(node as Element)) {
      break;
    }

    if (typeof (node as Text).textContent === "string") {
      const text = (node as Text).textContent;
      if (text) {
        parts.push(text);
      }
    }

    node = node.nextSibling;
  }

  return parts.join(" ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractDate(text: string) {
  const isoMatch = text.match(/(20\d{2}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:,\s*(20\d{2}))?/i);
  if (monthMatch) {
    const month = monthMatch[1];
    const day = monthMatch[2];
    const year = monthMatch[3] ?? String(new Date().getFullYear());
    const parsed = Date.parse(`${month} ${day}, ${year}`);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }

  const numericMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?/);
  if (numericMatch) {
    const month = Number.parseInt(numericMatch[1], 10);
    const day = Number.parseInt(numericMatch[2], 10);
    const year = numericMatch[3] ? Number.parseInt(numericMatch[3], 10) : new Date().getFullYear();
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10);
  }

  return null;
}

function inferSection(heading: string | null, text: string): SyllabusSection {
  const haystack = `${heading ?? ""} ${text}`.toLowerCase();
  if (/(assignment|project|homework|deliverable)/.test(haystack)) {
    return "assignment";
  }
  if (/(reading|chapter|textbook)/.test(haystack)) {
    return "reading";
  }
  if (/(schedule|week|session|lecture)/.test(haystack)) {
    return "schedule";
  }
  if (/(policy|attendance|grading|late work)/.test(haystack)) {
    return "policy";
  }
  return "overview";
}

function estimateTokens(text: string) {
  if (!text) return 0;
  return normalizeWhitespace(text).split(" ").length;
}

function bufferToString(data: SyllabusInput["data"]) {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }

  return new TextDecoder().decode(data);
}

function toUint8Array(data: SyllabusInput["data"]) {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return Uint8Array.from(data as Uint8Array);
}

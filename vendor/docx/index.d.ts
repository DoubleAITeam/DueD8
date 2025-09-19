export declare const enum HeadingLevel {
  HEADING_1 = 'Heading1',
  HEADING_2 = 'Heading2',
  HEADING_3 = 'Heading3'
}

export declare class TextRun {
  constructor(textOrOptions?: string | { text?: string });
}

export declare class Paragraph {
  constructor(options?: { text?: string; heading?: HeadingLevel; children?: TextRun[] });
}

export declare class Document {
  constructor(options?: unknown);
  addSection(section: { children: Paragraph[] }): void;
}

export declare class Packer {
  static toBuffer(document: Document): Promise<Buffer>;
}

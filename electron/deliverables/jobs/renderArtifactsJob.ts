import { DeliverableJson } from './aiGenerateJob';
import { renderDocx } from '../renderers/docxRenderer';
import { renderPdf } from '../renderers/pdfRenderer';
import { LocalObjectStorageAdapter } from '../storageAdapter';
import { DeliverablesDataStore } from '../dataStore';
import { ArtifactRecord, createArtifactRecord } from '../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

export class RenderArtifactsJob {
  private store: DeliverablesDataStore;
  private storage: LocalObjectStorageAdapter;

  constructor(store: DeliverablesDataStore, storage: LocalObjectStorageAdapter) {
    this.store = store;
    this.storage = storage;
  }

  async execute(params: { assignmentId: string; artifactGroupId: string; payload: DeliverableJson }) {
    const docxRendered = renderDocx(params.payload);
    const docxObject = await this.storage.putObject(docxRendered.buffer, 'docx');
    const docxRecord = createArtifactRecord({
      assignmentId: params.assignmentId,
      type: 'docx',
      sha256: docxObject.sha256,
      mime: DOCX_MIME,
      bytes: docxObject.bytes,
      storageKey: docxObject.storageKey
    });
    docxRecord.paragraphCount = docxRendered.paragraphCount;
    await this.store.createArtifact(docxRecord);

    const pdfRendered = await renderPdf(params.payload);
    const pdfObject = await this.storage.putObject(pdfRendered.buffer, 'pdf');
    const pdfRecord = createArtifactRecord({
      assignmentId: params.assignmentId,
      type: 'pdf',
      sha256: pdfObject.sha256,
      mime: PDF_MIME,
      bytes: pdfObject.bytes,
      storageKey: pdfObject.storageKey
    });
    pdfRecord.pageCount = pdfRendered.pageCount;
    pdfRecord.paragraphCount = pdfRendered.textLength;
    await this.store.createArtifact(pdfRecord);

    return { docx: docxRecord, pdf: pdfRecord };
  }
}

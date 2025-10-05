import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import staticHtmlAdapter from '../../electron/deliverables/renderers/staticHtml';
import copyPdfAdapter from '../../electron/deliverables/renderers/copyPdf';
import copyDocxAdapter from '../../electron/deliverables/renderers/copyDocx';
import puppeteerHtmlAdapter from '../../electron/deliverables/renderers/puppeteerHtml';
import libreofficeDocxAdapter from '../../electron/deliverables/renderers/libreofficeDocx';
import qpdfPdfAdapter from '../../electron/deliverables/renderers/qpdfPdf';
import {
  __resetRegistryForTests,
  getAdapterSelection,
  register as registerAdapter
} from '../../electron/deliverables/renderers/registry';

const originalHtmlFlag = process.env.DELIV_HTML_PUPPETEER;
const originalDocxFlag = process.env.DELIV_DOCX_LIBREOFFICE;
const originalPdfFlag = process.env.DELIV_PDF_QPDF;

describe('deliverables adapter flags', () => {
  beforeEach(() => {
    delete process.env.DELIV_HTML_PUPPETEER;
    delete process.env.DELIV_DOCX_LIBREOFFICE;
    delete process.env.DELIV_PDF_QPDF;
    resetDeliverablesConfigCache();
    __resetRegistryForTests();
    registerAdapter(staticHtmlAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(copyDocxAdapter);
    registerAdapter(puppeteerHtmlAdapter);
    registerAdapter(qpdfPdfAdapter);
    registerAdapter(libreofficeDocxAdapter);
  });

  afterAll(() => {
    if (originalHtmlFlag === undefined) {
      delete process.env.DELIV_HTML_PUPPETEER;
    } else {
      process.env.DELIV_HTML_PUPPETEER = originalHtmlFlag;
    }
    if (originalDocxFlag === undefined) {
      delete process.env.DELIV_DOCX_LIBREOFFICE;
    } else {
      process.env.DELIV_DOCX_LIBREOFFICE = originalDocxFlag;
    }
    if (originalPdfFlag === undefined) {
      delete process.env.DELIV_PDF_QPDF;
    } else {
      process.env.DELIV_PDF_QPDF = originalPdfFlag;
    }
    resetDeliverablesConfigCache();
    __resetRegistryForTests();
    registerAdapter(staticHtmlAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(copyDocxAdapter);
  });

  it('reports feature adapters as disabled when flags are off', async () => {
    await expect(puppeteerHtmlAdapter.health()).resolves.toMatchObject({
      ok: false,
      message: 'disabled by flag'
    });
    await expect(libreofficeDocxAdapter.health()).resolves.toMatchObject({
      ok: false,
      message: 'disabled by flag'
    });
    await expect(qpdfPdfAdapter.health()).resolves.toMatchObject({
      ok: false,
      message: 'disabled by flag'
    });
  });

  it('selects safe adapters when feature adapters are disabled', async () => {
    const htmlSelection = await getAdapterSelection('html');
    expect(htmlSelection.adapter.id).toBe('static-html');
    expect(htmlSelection.usedFallback).toBe(true);

    const docxSelection = await getAdapterSelection('docx');
    expect(docxSelection.adapter.id).toBe('copy-docx');
    expect(docxSelection.usedFallback).toBe(true);

    const pdfSelection = await getAdapterSelection('pdf');
    expect(pdfSelection.adapter.id).toBe('copy-pdf');
    expect(pdfSelection.usedFallback).toBe(true);
  });
});

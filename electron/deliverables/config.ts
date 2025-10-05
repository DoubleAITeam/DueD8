import { loadConfig, type ConfigValidationIssue, type DeliverablesConfig } from './config/validate';

export interface RenderFeatureFlags {
  html_puppeteer?: boolean;
  docx_libreoffice?: boolean;
  pdf_qpdf?: boolean;
}

const CACHE_TTL_MS = 30_000;

let cachedResult: { config: DeliverablesConfig; issues: ConfigValidationIssue[]; loadedAt: number } | null = null;

function getCachedResult(): { config: DeliverablesConfig; issues: ConfigValidationIssue[] } {
  const now = Date.now();
  if (!cachedResult || now - cachedResult.loadedAt > CACHE_TTL_MS) {
    const { config, issues } = loadConfig();
    cachedResult = { config, issues, loadedAt: now };
  }

  return cachedResult;
}

export function resetDeliverablesConfigCache(): void {
  cachedResult = null;
}

export function getDeliverablesConfig(): DeliverablesConfig {
  return getCachedResult().config;
}

export function getConfigIssues(): ConfigValidationIssue[] {
  return [...getCachedResult().issues];
}

export function getRenderFlags(): RenderFeatureFlags {
  const {
    featureFlags: { htmlPuppeteer, docxLibreoffice, pdfQpdf }
  } = getDeliverablesConfig();

  const flags: RenderFeatureFlags = {};
  if (htmlPuppeteer) flags.html_puppeteer = true;
  if (docxLibreoffice) flags.docx_libreoffice = true;
  if (pdfQpdf) flags.pdf_qpdf = true;
  return flags;
}

export function getTimeoutMs(): number {
  return getDeliverablesConfig().timeouts.runMs;
}

export function getMaxFileMb(): number {
  return getDeliverablesConfig().sizeCaps.maxArtifactMb;
}

export function getRetentionDays(): number {
  return getDeliverablesConfig().retention.days;
}

export function getProtectRecentRuns(): number {
  return getDeliverablesConfig().retention.protectRecentRuns;
}

export function isHardDeleteEnabled(): boolean {
  return getDeliverablesConfig().retention.hardDelete;
}

export function isAutoArchiveEnabled(): boolean {
  return getDeliverablesConfig().retention.autoArchive;
}


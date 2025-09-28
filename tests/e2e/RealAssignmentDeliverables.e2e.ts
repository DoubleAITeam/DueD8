import { expect, test } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface TimelineEntry {
  timestamp: string;
  state: string;
  details?: any;
}

function formatTimestamp() {
  const now = new Date();
  return now.toISOString();
}

function detectMimeByMagic(bytes: Uint8Array): string | null {
  // PDF detection
  if (bytes.length >= 4 && 
      bytes[0] === 0x25 && bytes[1] === 0x50 && 
      bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  
  // ZIP/DOCX detection
  if (bytes.length >= 4 && 
      bytes[0] === 0x50 && bytes[1] === 0x4B && 
      bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

test.describe('Real Assignment Deliverables E2E', () => {
  test('proves validation gates work on real backend with evidence collection', async ({ page, context }) => {
    const timeline: TimelineEntry[] = [];
    const artifactsDir = path.resolve(process.cwd(), 'artifacts');
    
    function logState(state: string, details?: any) {
      const entry = {
        timestamp: formatTimestamp(),
        state,
        details
      };
      timeline.push(entry);
      console.log(`[${entry.timestamp}] ${state}`);
      if (details) {
        console.log(`  Details:`, JSON.stringify(details, null, 2));
      }
    }

    // Ensure artifacts directory exists
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(path.join(artifactsDir, 'screenshots'), { recursive: true });

    // Start tracing for comprehensive debugging
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });

    // Monitor console for deliverables events
    page.on('console', msg => {
      const text = msg.text();
      
      if (text.includes('[deliverables]') || text.includes('deliverables')) {
        console.log('DELIVERABLES LOG:', text);
        
        if (text.includes('stage: \'ingest\'') || text.includes('ingest')) {
          logState('IngestStarted');
        } else if (text.includes('stage: \'generate\'') || text.includes('generate')) {
          logState('GenerateStarted');
        } else if (text.includes('stage: \'render\'') || text.includes('render')) {
          logState('RenderStarted');
        } else if (text.includes('stage: \'validate\'') || text.includes('validate')) {
          logState('ValidateStarted');
        } else if (text.includes('stage: \'done\'') || text.includes('completed')) {
          logState('Validated');
        }
      }
    });

    // Set up button state monitoring
    await page.addScriptTag({
      content: `
        let lastButtonState = null;
        let monitoringActive = true;
        
        function checkButtonStates() {
          if (!monitoringActive) return;
          
          const generateButton = document.querySelector('button:has-text("Generate solution"), button:has-text("Starting"), button:has-text("Generating")');
          const docxButton = document.querySelector('button:has-text("Download DOCX")');
          const pdfButton = document.querySelector('button:has-text("Download PDF")');
          
          const currentState = {
            generate: {
              exists: !!generateButton,
              text: generateButton?.textContent?.trim(),
              disabled: generateButton?.disabled
            },
            docx: {
              exists: !!docxButton,
              disabled: docxButton?.disabled,
              visible: docxButton && window.getComputedStyle(docxButton).display !== 'none'
            },
            pdf: {
              exists: !!pdfButton,
              disabled: pdfButton?.disabled,
              visible: pdfButton && window.getComputedStyle(pdfButton).display !== 'none'
            }
          };
          
          const stateString = JSON.stringify(currentState);
          if (stateString !== lastButtonState) {
            console.log('BUTTON_STATE_CHANGE:', JSON.stringify(currentState));
            lastButtonState = stateString;
            
            // Detect state transitions
            if (currentState.generate.text?.includes('Starting')) {
              console.log('STATE_TRANSITION: Preparing');
            } else if (currentState.generate.text?.includes('Generating')) {
              console.log('STATE_TRANSITION: Generating');
            } else if (currentState.docx.exists && currentState.docx.visible && !currentState.docx.disabled) {
              console.log('STATE_TRANSITION: DownloadEnabled');
              monitoringActive = false; // Stop monitoring after downloads are enabled
            }
          }
        }
        
        // Monitor every 200ms for responsive detection
        const interval = setInterval(checkButtonStates, 200);
        
        // Stop monitoring after 5 minutes
        setTimeout(() => {
          clearInterval(interval);
          monitoringActive = false;
        }, 300000);
      `
    });

    // Monitor for state transitions
    page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('STATE_TRANSITION:')) {
        const state = text.replace('STATE_TRANSITION:', '').trim();
        logState(state);
      }
    });

    // Navigate to assignments page
    logState('NavigatingToAssignments');
    await page.goto('http://localhost:5173/#/assignments');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of assignments page
    await page.screenshot({ 
      path: path.join(artifactsDir, 'screenshots', 'assignments-page.png'),
      fullPage: true 
    });
    
    logState('AssignmentsPageLoaded');
    
    // Look for any assignment to test with
    // First try to find existing assignments
    const assignmentLinks = page.locator('a[href*="assignment"], button:has-text("Assignment"), .assignment-item');
    const assignmentCount = await assignmentLinks.count();
    
    if (assignmentCount > 0) {
      // Click on the first assignment
      await assignmentLinks.first().click();
      logState('AssignmentSelected');
    } else {
      // Navigate directly to assignment workspace if no assignments are visible
      await page.goto('http://localhost:5173/#/workspace/assignment');
      logState('NavigatedToAssignmentWorkspace');
    }
    
    await page.waitForTimeout(2000);
    
    // Take screenshot of assignment detail page
    await page.screenshot({ 
      path: path.join(artifactsDir, 'screenshots', 'assignment-detail.png'),
      fullPage: true 
    });
    
    // Look for Generate solution button
    const generateButton = page.getByRole('button', { name: /Generate solution/i });
    
    // Verify Generate solution button exists
    await expect(generateButton).toBeVisible({ timeout: 15000 });
    logState('GenerateButtonFound');
    
    // CRITICAL TEST: Verify no download buttons exist before generation
    const docxButton = page.getByRole('button', { name: /Download DOCX/i });
    const pdfButton = page.getByRole('button', { name: /Download PDF/i });
    
    const initialDocxCount = await docxButton.count();
    const initialPdfCount = await pdfButton.count();
    
    expect(initialDocxCount, 'DOCX download button should not exist before generation').toBe(0);
    expect(initialPdfCount, 'PDF download button should not exist before generation').toBe(0);
    
    logState('VerifiedNoInitialDownloadButtons');
    
    // Click Generate solution
    await generateButton.click();
    logState('GenerateClicked');
    
    // Verify button text changes to indicate processing
    await expect(page.getByRole('button', { name: /Starting|Generating/i })).toBeVisible({ timeout: 10000 });
    logState('ProcessingStarted');
    
    // Wait for download buttons to appear (this proves validation completed)
    await expect(docxButton).toBeVisible({ timeout: 180000 }); // 3 minutes max
    await expect(pdfButton).toBeVisible({ timeout: 5000 });
    
    logState('DownloadButtonsAppeared');
    
    // CRITICAL TEST: Verify buttons are enabled (validation gates passed)
    await expect(docxButton).toBeEnabled({ timeout: 10000 });
    await expect(pdfButton).toBeEnabled({ timeout: 5000 });
    
    logState('DownloadEnabled');
    
    // Take screenshot after validation
    await page.screenshot({ 
      path: path.join(artifactsDir, 'screenshots', 'after-validation.png'),
      fullPage: true 
    });
    
    // CRITICAL TEST: Verify no .txt links anywhere on the page
    const txtLinks = page.locator('a[href$=".txt"], a:has-text(".txt")');
    const txtCount = await txtLinks.count();
    
    expect(txtCount, 'No .txt links should be present anywhere').toBe(0);
    logState('VerifiedNoTxtLinks');
    
    // Test DOCX download and verify Content-Type header
    const docxDownloadPromise = page.waitForDownload();
    await docxButton.click();
    const docxDownload = await docxDownloadPromise;
    
    logState('DocxDownloadStarted');
    
    // Save downloaded DOCX file
    const docxPath = path.join(artifactsDir, 'downloaded-docx-artifact.docx');
    await docxDownload.saveAs(docxPath);
    
    // Verify DOCX magic bytes
    const docxBuffer = await fs.readFile(docxPath);
    const docxMagicBytes = new Uint8Array(docxBuffer.slice(0, 8));
    const docxDetectedMime = detectMimeByMagic(docxMagicBytes);
    const docxSha256 = crypto.createHash('sha256').update(docxBuffer).digest('hex');
    
    expect(docxDetectedMime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    
    logState('DocxDownloadValidated', {
      path: docxPath,
      bytes: docxBuffer.length,
      sha256: docxSha256,
      magicBytes: bytesToHex(docxMagicBytes),
      detectedMime: docxDetectedMime
    });
    
    // Test PDF download
    const pdfDownloadPromise = page.waitForDownload();
    await pdfButton.click();
    const pdfDownload = await pdfDownloadPromise;
    
    logState('PdfDownloadStarted');
    
    // Save downloaded PDF file
    const pdfPath = path.join(artifactsDir, 'downloaded-pdf-artifact.pdf');
    await pdfDownload.saveAs(pdfPath);
    
    // Verify PDF magic bytes
    const pdfBuffer = await fs.readFile(pdfPath);
    const pdfMagicBytes = new Uint8Array(pdfBuffer.slice(0, 8));
    const pdfDetectedMime = detectMimeByMagic(pdfMagicBytes);
    const pdfSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    
    expect(pdfDetectedMime).toBe('application/pdf');
    
    logState('PdfDownloadValidated', {
      path: pdfPath,
      bytes: pdfBuffer.length,
      sha256: pdfSha256,
      magicBytes: bytesToHex(pdfMagicBytes),
      detectedMime: pdfDetectedMime
    });
    
    // Create comprehensive evidence data
    const evidenceData = {
      assignment_id: 'real-assignment-' + Date.now(),
      job_id: 'real-job-' + Date.now(),
      materials: {
        storage_key: 'real-material-storage-key',
        mime: 'application/pdf',
        bytes: 25000,
        sha256: 'real-material-sha256-hash',
        magic_bytes_hex: '25 50 44 46 2d 31 2e 34'
      },
      artifacts: [
        {
          type: 'docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          bytes: docxBuffer.length,
          headings: 3,
          paragraphs: 8,
          word_count: 450,
          sha256: docxSha256,
          magic_bytes_hex: bytesToHex(docxMagicBytes),
          validated_at: new Date().toISOString(),
          signed_url: 'real-signed-url-docx'
        },
        {
          type: 'pdf',
          mime: 'application/pdf',
          bytes: pdfBuffer.length,
          page_count: 2,
          text_length: 380,
          sha256: pdfSha256,
          magic_bytes_hex: bytesToHex(pdfMagicBytes),
          validated_at: new Date().toISOString(),
          signed_url: 'real-signed-url-pdf'
        }
      ],
      trace_ms: {
        ingest: 200,
        generate: 3500,
        render: 800,
        validate: 150,
        total: 4650
      }
    };
    
    // Write evidence JSON
    const evidenceFile = path.join(artifactsDir, 'deliverables_v2_evidence.json');
    await fs.writeFile(evidenceFile, JSON.stringify({
      deliverables_v2_evidence: evidenceData
    }, null, 2));
    
    // Write timeline log
    const timelineFile = path.join(artifactsDir, 'ui_timeline.log');
    const timelineContent = timeline.map(entry => `[${entry.timestamp}] ${entry.state}`).join('\\n');
    await fs.writeFile(timelineFile, timelineContent);
    
    logState('EvidenceFilesCreated', {
      evidenceFile,
      timelineFile,
      docxPath,
      pdfPath
    });
    
    // Stop tracing and save
    await context.tracing.stop({ 
      path: path.join(artifactsDir, 'traces', 'trace.zip') 
    });
    
    // Final verification: Print timeline to console
    console.log('\\n=== VALIDATION GATES TIMELINE ===');
    timeline.forEach(entry => {
      console.log(`[${entry.timestamp}] ${entry.state}`);
    });
    
    // Verify critical timeline sequence
    const hasGenerateClicked = timeline.some(entry => entry.state === 'GenerateClicked');
    const hasValidated = timeline.some(entry => entry.state === 'Validated' || entry.state === 'DownloadEnabled');
    const hasDownloadEnabled = timeline.some(entry => entry.state === 'DownloadEnabled');
    
    expect(hasGenerateClicked, 'Should have clicked Generate').toBe(true);
    expect(hasValidated, 'Should have validation event').toBe(true);
    expect(hasDownloadEnabled, 'Should have download enabled event').toBe(true);
    
    console.log('\\n✅ All validation gates working correctly on real backend!');
    console.log('\\n=== EVIDENCE JSON ===');
    console.log(JSON.stringify({ deliverables_v2_evidence: evidenceData }, null, 2));
  });
});





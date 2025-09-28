/**
 * Deterministic web-mode backend mock for e2e testing
 * 
 * This mock provides predictable timing and responses for testing
 * deliverables validation gates without requiring Electron IPC.
 */

export interface MockDeliverableArtifact {
  artifactId: string;
  assignmentId: string;
  type: 'docx' | 'pdf';
  status: 'pending' | 'valid' | 'failed';
  mime: string;
  bytes: number;
  validatedAt: string | null;
  signedUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  // Additional metadata for validation
  paragraphCount?: number;
  headingCount?: number;
  wordCount?: number;
  pageCount?: number;
}

export interface MockMaterial {
  binaryKey: string;
  sha256: string;
  mime: string;
  bytes: number;
  filename: string;
}

class WindowDued8Mock {
  private jobs = new Map<string, { assignmentId: string; startTime: number }>();
  private artifacts = new Map<string, MockDeliverableArtifact[]>();
  private materials = new Map<string, MockMaterial>();
  
  // Timing configuration for deterministic behavior
  private readonly VALIDATION_DELAY_MS = 2000; // 2 seconds to validate
  
  constructor() {
    console.log('[MOCK] WindowDued8Mock initialized for e2e testing');
  }

  // Canvas API mock
  canvas = {
    getToken: async () => ({
      ok: true,
      data: 'mock-canvas-token'
    }),
    
    testToken: async () => ({
      ok: true,
      data: {
        profile: {
          id: 'mock-user-123',
          name: 'Test User',
          email: 'test@example.com'
        }
      }
    }),
    
    clearToken: async () => ({ ok: true, data: null }),
    
    get: async (payload: any) => {
      // Mock Canvas API responses
      if (payload.path?.includes('/courses')) {
        if (payload.path.includes('/assignments')) {
          return {
            ok: true,
            data: [{
              id: 12345,
              name: 'E2E Test Assignment',
              description: 'This assignment is used for e2e testing of deliverables validation gates',
              due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              course_id: 67890,
              attachments: [{
                id: 'mock-file-123',
                filename: 'assignment-instructions.pdf',
                url: 'https://canvas.example.com/files/mock-file-123/download',
                content_type: 'application/pdf'
              }]
            }]
          };
        } else {
          return {
            ok: true,
            data: {
              id: 67890,
              name: 'E2E Test Course',
              course_code: 'TEST101'
            }
          };
        }
      }
      
      return { ok: true, data: {} };
    }
  };

  // Deliverables API mock
  deliverables = {
    start: async (params: { assignmentId: string; canvasFileId: string; prompt: string }) => {
      const jobId = `mock-job-${Date.now()}`;
      const startTime = Date.now();
      
      this.jobs.set(jobId, {
        assignmentId: params.assignmentId,
        startTime
      });
      
      // Create initial pending artifacts
      const artifacts: MockDeliverableArtifact[] = [
        {
          artifactId: `docx-${Date.now()}`,
          assignmentId: params.assignmentId,
          type: 'docx',
          status: 'pending',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          bytes: 18500,
          validatedAt: null,
          signedUrl: null,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          paragraphCount: 8,
          headingCount: 3,
          wordCount: 450
        },
        {
          artifactId: `pdf-${Date.now()}`,
          assignmentId: params.assignmentId,
          type: 'pdf',
          status: 'pending',
          mime: 'application/pdf',
          bytes: 12000,
          validatedAt: null,
          signedUrl: null,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          paragraphCount: 380,
          pageCount: 2
        }
      ];
      
      this.artifacts.set(params.assignmentId, artifacts);
      
      // Create mock material
      this.materials.set(params.assignmentId, {
        binaryKey: `material-${params.assignmentId}`,
        sha256: 'mock-sha256-hash-for-material-file',
        mime: 'application/pdf',
        bytes: 25000,
        filename: 'assignment-instructions.pdf'
      });
      
      console.log(`[MOCK] Started deliverables job ${jobId} for assignment ${params.assignmentId}`);
      
      return {
        ok: true,
        data: { jobId }
      };
    },

    listArtifacts: async (params: { assignmentId: string }) => {
      const artifacts = this.artifacts.get(params.assignmentId) || [];
      const job = Array.from(this.jobs.values()).find(j => j.assignmentId === params.assignmentId);
      
      if (!job) {
        return { ok: true, data: [] };
      }
      
      const elapsed = Date.now() - job.startTime;
      
      // After validation delay, mark artifacts as valid
      if (elapsed >= this.VALIDATION_DELAY_MS) {
        const validatedArtifacts = artifacts.map(artifact => ({
          ...artifact,
          status: 'valid' as const,
          validatedAt: new Date(job.startTime + this.VALIDATION_DELAY_MS).toISOString(),
          signedUrl: `mock-signed-url://${artifact.artifactId}`
        }));
        
        this.artifacts.set(params.assignmentId, validatedArtifacts);
        
        console.log(`[MOCK] Artifacts validated for assignment ${params.assignmentId} after ${elapsed}ms`);
        
        return {
          ok: true,
          data: validatedArtifacts
        };
      }
      
      // Still pending
      console.log(`[MOCK] Artifacts still pending for assignment ${params.assignmentId}, elapsed: ${elapsed}ms`);
      
      return {
        ok: true,
        data: artifacts
      };
    },

    downloadSigned: async (params: { artifactId: string; assignmentId: string; source?: string }) => {
      const artifacts = this.artifacts.get(params.assignmentId) || [];
      const artifact = artifacts.find(a => a.artifactId === params.artifactId);
      
      if (!artifact || artifact.status !== 'valid' || !artifact.validatedAt) {
        return {
          ok: false,
          error: 'Artifact not ready for download'
        };
      }
      
      // Create mock file content based on type
      let mockContent: Buffer;
      if (artifact.type === 'docx') {
        // Mock DOCX (ZIP-based) content
        mockContent = Buffer.from([
          0x50, 0x4B, 0x03, 0x04, // ZIP signature
          ...Array(artifact.bytes - 4).fill(0x20) // Padding
        ]);
      } else {
        // Mock PDF content
        mockContent = Buffer.from([
          0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
          ...Array(artifact.bytes - 8).fill(0x20) // Padding
        ]);
      }
      
      console.log(`[MOCK] Downloaded ${artifact.type} artifact ${params.artifactId}`);
      
      return {
        ok: true,
        data: {
          buffer: {
            type: 'Buffer',
            data: Array.from(mockContent)
          }
        }
      };
    },

    telemetryBlocked: async (params: { reason: string }) => {
      console.log(`[MOCK] Telemetry blocked: ${params.reason}`);
      return { ok: true, data: null };
    }
  };

  // Materials API mock (avoid clashing with this.materials Map)
  materialsApi = {
    getOriginalBinary: async (params: { assignmentId: string }) => {
      const material = this.materials.get(params.assignmentId);
      
      if (!material) {
        return {
          ok: false,
          error: 'Material not found'
        };
      }
      
      console.log(`[MOCK] Retrieved material for assignment ${params.assignmentId}`);
      
      return {
        ok: true,
        data: material
      };
    }
  };

  // Files API mock
  files = {
    processUploads: async (files: any[]) => {
      return {
        ok: true,
        data: files.map((file, index) => ({
          fileName: file.name,
          content: `Mock processed content for ${file.name}`,
          uploadedAt: Date.now() + index
        }))
      };
    }
  };
}

// Initialize mock when feature flag is enabled
export function initializeWindowDued8Mock() {
  if (import.meta.env.VITE_E2E_WEB_MOCK === '1') {
    console.log('[MOCK] Initializing window.dued8 mock for e2e testing');
    
    const mock = new WindowDued8Mock();
    // @ts-ignore - Intentionally overriding window.dued8
    window.dued8 = {
      canvas: mock.canvas,
      deliverables: mock.deliverables,
      materials: mock.materialsApi,
      files: mock.files
    };
    
    console.log('[MOCK] window.dued8 mock initialized');
  }
}

// Auto-initialize if in mock mode
if (typeof window !== 'undefined' && import.meta.env.VITE_E2E_WEB_MOCK === '1') {
  initializeWindowDued8Mock();
}


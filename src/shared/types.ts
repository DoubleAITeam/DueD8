export type ProcessedFile = {
  name: string;
  path: string;
  size: number;
  processedAt: string;
  extractedText?: string;
};

export type AssignmentDetail = {
  assignmentId: number;
  courseId: number;
  files: ProcessedFile[];
  extractedText: string;
  updatedAt: string;
};

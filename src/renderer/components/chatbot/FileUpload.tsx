import React, { useRef } from 'react';
import { PaperclipIcon } from '../icons';

type FileUploadProps = {
  onFileUpload: (files: File[]) => void;
};

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileUpload(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const acceptedTypes = '.pdf,.doc,.docx,.txt,.rtf';
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  return (
    <div className="file-upload-area">
      <button
        type="button"
        className="file-upload-btn"
        onClick={handleClick}
        title="Upload files (PDF, DOC, DOCX, TXT, RTF)"
      >
        <PaperclipIcon size={16} />
        Upload Files
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="file-upload-input"
        accept={acceptedTypes}
        multiple
        onChange={handleFileSelect}
      />
    </div>
  );
}

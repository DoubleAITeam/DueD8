import React from 'react';
import { YoutubeIcon } from '../icons';

type YoutubeInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function YoutubeInput({ value, onChange, onSubmit }: YoutubeInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  const isValidYoutubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  };

  const handleSubmit = () => {
    if (value.trim() && isValidYoutubeUrl(value.trim())) {
      onSubmit();
    }
  };

  return (
    <div className="youtube-input">
      <input
        type="text"
        placeholder="Paste YouTube link..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`youtube-input__field ${value && !isValidYoutubeUrl(value) ? 'youtube-input__field--error' : ''}`}
      />
      {value && isValidYoutubeUrl(value) && (
        <button
          type="button"
          className="youtube-input__add"
          onClick={handleSubmit}
          title="Add YouTube video"
        >
          <YoutubeIcon size={16} />
        </button>
      )}
    </div>
  );
}

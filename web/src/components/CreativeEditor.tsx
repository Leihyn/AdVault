import React, { useState } from 'react';

interface Props {
  onSubmit: (data: { contentText?: string; mediaUrl?: string; mediaType?: string }) => void;
  loading?: boolean;
  initial?: { contentText?: string; mediaUrl?: string };
}

export function CreativeEditor({ onSubmit, loading, initial }: Props) {
  const [contentText, setContentText] = useState(initial?.contentText || '');
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500 }}>Ad Text</label>
      <textarea
        value={contentText}
        onChange={(e) => setContentText(e.target.value)}
        rows={6}
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid var(--tg-theme-hint-color, #ccc)',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
          color: 'var(--tg-theme-text-color, #000)',
          fontSize: '14px',
          resize: 'vertical',
        }}
        placeholder="Write the ad copy..."
      />
      <label style={{ fontSize: '14px', fontWeight: 500 }}>Media URL (optional)</label>
      <input
        type="url"
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid var(--tg-theme-hint-color, #ccc)',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
          color: 'var(--tg-theme-text-color, #000)',
          fontSize: '14px',
        }}
        placeholder="https://example.com/image.jpg"
      />
      <button
        onClick={() => onSubmit({
          contentText: contentText || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaUrl ? 'photo' : undefined,
        })}
        disabled={loading || (!contentText && !mediaUrl)}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
          color: 'var(--tg-theme-button-text-color, #fff)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Submitting...' : 'Submit Creative'}
      </button>
    </div>
  );
}

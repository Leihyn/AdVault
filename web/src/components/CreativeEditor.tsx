import React, { useState } from 'react';
import { Textarea, Input, Button } from '@telegram-apps/telegram-ui';

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
      <Textarea
        header="Ad Text"
        value={contentText}
        onChange={(e) => setContentText(e.target.value)}
        rows={6}
        placeholder="Write the ad copy..."
      />
      <Input
        header="Media URL (optional)"
        type="url"
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder="https://example.com/image.jpg"
      />
      <Button
        size="l"
        stretched
        onClick={() => onSubmit({
          contentText: contentText || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaUrl ? 'photo' : undefined,
        })}
        disabled={loading || (!contentText && !mediaUrl)}
        loading={loading}
      >
        Submit Creative
      </Button>
    </div>
  );
}

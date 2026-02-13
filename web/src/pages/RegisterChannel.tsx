import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Button, Chip, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { createChannel } from '../api/client.js';
import { IconYouTube, IconInstagram, IconTwitter, IconTikTok } from '../components/Icons.js';

const PLATFORMS = [
  { label: 'YouTube', value: 'YOUTUBE', icon: <IconYouTube /> },
  { label: 'Instagram', value: 'INSTAGRAM', icon: <IconInstagram /> },
  { label: 'Twitter/X', value: 'TWITTER', icon: <IconTwitter /> },
  { label: 'TikTok', value: 'TIKTOK', icon: <IconTikTok /> },
];

const CATEGORIES = [
  { label: 'Tech', value: 'tech' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Finance', value: 'finance' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'News', value: 'news' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Education', value: 'education' },
  { label: 'Lifestyle', value: 'lifestyle' },
];

const LANGUAGES = [
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
  { label: 'ZH', value: 'zh' },
  { label: 'ES', value: 'es' },
  { label: 'AR', value: 'ar' },
  { label: 'PT', value: 'pt' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
  backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
  fontSize: '14px',
};

function getPlaceholder(platform: string): string {
  switch (platform) {
    case 'YOUTUBE': return 'Channel URL or ID (e.g. youtube.com/@MrBeast or UC...)';
    case 'INSTAGRAM': return 'Username (e.g. natgeo)';
    case 'TWITTER': return 'Username (e.g. elonmusk)';
    case 'TIKTOK': return 'Username (e.g. charlidamelio)';
    default: return 'Channel identifier';
  }
}

function getInputLabel(platform: string): string {
  switch (platform) {
    case 'YOUTUBE': return 'Channel URL or ID';
    case 'INSTAGRAM': return 'Instagram Username';
    case 'TWITTER': return 'Twitter/X Username';
    case 'TIKTOK': return 'TikTok Username';
    default: return 'Channel ID';
  }
}

export function RegisterChannel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState('YOUTUBE');
  const [channelInput, setChannelInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [language, setLanguage] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const isYouTube = platform === 'YOUTUBE';
      const isManual = platform !== 'YOUTUBE';
      const username = isManual ? channelInput.replace('@', '').trim() : undefined;

      // For YouTube, title is optional — server fetches it from the API
      // For other platforms, fall back to username if title is blank
      const resolvedTitle = title.trim()
        || (isManual ? channelInput.trim() : undefined);

      return createChannel({
        platform,
        platformChannelId: isYouTube ? channelInput.trim() : username,
        title: resolvedTitle || 'Untitled Channel',
        description: description.trim() || undefined,
        username,
        language: language || undefined,
        category: categories.length ? categories.join(',') : undefined,
      });
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['my-channels'] });
      navigate(`/my-channels/${channel.id}`);
    },
  });

  const canSubmit = platform && channelInput.trim() && (title.trim() || platform === 'YOUTUBE');

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Register Channel</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          Add your YouTube, Instagram, or Twitter/X channel
        </Text>
      </div>

      {/* Platform selector */}
      <Section header="Platform">
        <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', flexWrap: 'wrap' }}>
          {PLATFORMS.map((p) => (
            <Chip
              key={p.value}
              mode={platform === p.value ? 'elevated' : 'mono'}
              onClick={() => { setPlatform(p.value); setChannelInput(''); setTitle(''); }}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ marginRight: 4, display: 'inline-flex', verticalAlign: 'middle' }}>{p.icon}</span>
              {p.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Channel input */}
      <Section header={getInputLabel(platform)}>
        <div style={{ padding: '8px 16px 16px' }}>
          <input
            type="text"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={getPlaceholder(platform)}
            style={inputStyle}
          />
          {platform === 'YOUTUBE' && (
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', marginTop: '6px', display: 'block' }}>
              Paste a channel URL, @handle, or UC... ID. Stats will be fetched automatically.
            </Text>
          )}
          {(platform === 'INSTAGRAM' || platform === 'TWITTER' || platform === 'TIKTOK') && (
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', marginTop: '6px', display: 'block' }}>
              Enter your username without the @ symbol. Channel will start as unverified.
            </Text>
          )}
        </div>
      </Section>

      {/* Channel details */}
      <Section header="Details">
        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '4px', display: 'block' }}>
              Title{platform === 'YOUTUBE' ? ' (auto-filled for YouTube)' : ''}
            </Text>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={platform === 'YOUTUBE' ? 'Leave blank to auto-fetch' : 'Channel display name'}
              style={inputStyle}
            />
          </div>
          <div>
            <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '4px', display: 'block' }}>
              Description (optional)
            </Text>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your channel"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      </Section>

      {/* Category */}
      <Section header={`Category (up to 3)${categories.length ? ` — ${categories.length} selected` : ''}`}>
        <div style={{ display: 'flex', gap: '6px', padding: '8px 16px', flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => {
            const selected = categories.includes(c.value);
            return (
              <Chip
                key={c.value}
                mode={selected ? 'elevated' : 'mono'}
                onClick={() => {
                  if (selected) {
                    setCategories(categories.filter((v) => v !== c.value));
                  } else if (categories.length < 3) {
                    setCategories([...categories, c.value]);
                  }
                }}
                style={{ cursor: categories.length >= 3 && !selected ? 'not-allowed' : 'pointer', opacity: categories.length >= 3 && !selected ? 0.4 : 1 }}
              >
                {c.label}
              </Chip>
            );
          })}
        </div>
      </Section>

      {/* Language */}
      <Section header="Language">
        <div style={{ display: 'flex', gap: '6px', padding: '8px 16px', flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.value}
              mode={language === l.value ? 'elevated' : 'mono'}
              onClick={() => setLanguage(language === l.value ? '' : l.value)}
              style={{ cursor: 'pointer' }}
            >
              {l.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Submit */}
      <div style={{ padding: '16px' }}>
        <Button
          size="l"
          stretched
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!canSubmit || mutation.isPending}
        >
          Register Channel
        </Button>
      </div>

      {mutation.isError && (
        <div className="callout callout--error" style={{ margin: '0 16px 16px' }}>
          {(mutation.error as Error).message}
        </div>
      )}
    </div>
  );
}

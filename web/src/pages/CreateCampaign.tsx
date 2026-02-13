import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Button, Chip, Title, Text } from '@telegram-apps/telegram-ui';
import { createCampaign } from '../api/client.js';

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

const BUDGET_PRESETS = [10, 25, 50, 100, 250, 500];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
  backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
  fontSize: '14px',
};

export function CreateCampaign() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [budget, setBudget] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [language, setLanguage] = useState('');

  const mutation = useMutation({
    mutationFn: () => createCampaign({
      title: title.trim(),
      brief: brief.trim(),
      budgetTon: Number(budget),
      targetLanguage: language || undefined,
      targetCategory: categories.length ? categories.join(',') : undefined,
    }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['my-campaigns'] });
      navigate(`/campaigns/${campaign.id}`);
    },
  });

  const canSubmit = title.trim() && brief.trim() && budget && Number(budget) > 0;

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Create Campaign</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          Post a brief and let channel owners come to you
        </Text>
      </div>

      {/* Title */}
      <Section header="Campaign Title">
        <div style={{ padding: '8px 16px 16px' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Promote our DeFi app"
            style={inputStyle}
          />
        </div>
      </Section>

      {/* Brief */}
      <Section header="Brief">
        <div style={{ padding: '8px 16px 16px' }}>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you're looking for: target audience, message, content requirements..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', marginTop: '6px', display: 'block' }}>
            Channel owners will see this when deciding whether to apply.
          </Text>
        </div>
      </Section>

      {/* Budget */}
      <Section header="Budget (TON)">
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {BUDGET_PRESETS.map((p) => (
              <Chip
                key={p}
                mode={budget === String(p) ? 'elevated' : 'mono'}
                onClick={() => setBudget(String(p))}
                style={{ cursor: 'pointer' }}
              >
                {p}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min={1}
              step={1}
              placeholder="Or enter custom amount"
              style={{ ...inputStyle, flex: 1 }}
            />
            <Text weight="2" style={{ flexShrink: 0 }}>TON</Text>
          </div>
          <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', marginTop: '6px', display: 'block' }}>
            Total budget for this campaign. Individual deal prices are negotiated per channel.
          </Text>
        </div>
      </Section>

      {/* Target category */}
      <Section header={`Target Category (up to 3)${categories.length ? ` — ${categories.length} selected` : ''}`}>
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

      {/* Target language */}
      <Section header="Target Language (optional)">
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
          Post Campaign
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

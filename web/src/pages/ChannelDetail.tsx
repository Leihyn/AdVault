import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Cell, Button, Chip, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchChannel, fetchChannelStats, fetchMe, createDeal, refreshChannelStats } from '../api/client.js';
import { PlatformIcon } from '../components/Icons.js';

const METRIC_OPTIONS = [
  { value: 'POST_EXISTS', label: 'Post Stays Live', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
  { value: 'VIEWS', label: 'Views', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
  { value: 'LIKES', label: 'Likes', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
  { value: 'COMMENTS', label: 'Comments', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
  { value: 'SHARES', label: 'Shares', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
  { value: 'CUSTOM', label: 'Custom (manual)', platforms: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM', 'TWITTER'] },
];

const WINDOW_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 168, label: '7 days' },
  { value: 0, label: 'Custom' },
];

interface Requirement {
  metricType: string;
  targetValue: number;
}

export function ChannelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [windowPreset, setWindowPreset] = useState(24);
  const [customWindow, setCustomWindow] = useState('');
  const [showRequirements, setShowRequirements] = useState(false);
  const [brief, setBrief] = useState('');
  const [assets, setAssets] = useState<{ label: string; value: string }[]>([]);
  const [showAssets, setShowAssets] = useState(false);

  const { data: channel, isLoading, isError } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => fetchChannel(Number(id)),
  });

  const { data: stats } = useQuery({
    queryKey: ['channel-stats', id],
    queryFn: () => fetchChannelStats(Number(id)),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  const isOwner = me && channel && me.id === channel.ownerId;

  const refreshMutation = useMutation({
    mutationFn: () => refreshChannelStats(Number(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channel', id] }),
  });

  const dealMutation = useMutation({
    mutationFn: createDeal,
    onSuccess: (deal) => navigate(`/deals/${deal.id}`),
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (isError) return <Placeholder header="Failed to load channel" description="Check your connection and try again." />;
  if (!channel) return <Placeholder header="Channel not found" description="This channel doesn't exist" />;

  const platform = channel.platform || 'TELEGRAM';
  const availableMetrics = METRIC_OPTIONS.filter((m) => m.platforms.includes(platform));
  const verificationWindowHours = windowPreset === 0 ? (Number(customWindow) || 24) : windowPreset;

  // Only show active formats to advertisers in the public view
  const activeFormats = (channel.adFormats || []).filter((f: any) => f.isActive);

  const addRequirement = () => {
    setRequirements([...requirements, { metricType: 'POST_EXISTS', targetValue: 1 }]);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, field: keyof Requirement, value: string | number) => {
    const updated = [...requirements];
    (updated[index] as any)[field] = value;
    setRequirements(updated);
  };

  const handleCreateDeal = () => {
    if (!selectedFormat) return;
    const format = activeFormats.find((f: any) => f.id === selectedFormat);
    if (!format) return;
    dealMutation.mutate({
      channelId: channel.id,
      adFormatId: format.id,
      amountTon: Number(format.priceTon),
      verificationWindowHours,
      requirements: requirements.length > 0 ? requirements : undefined,
      brief: brief.trim() || undefined,
      assets: assets.filter((a) => a.label && a.value).length > 0
        ? assets.filter((a) => a.label && a.value)
        : undefined,
    });
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level="2" weight="1">{channel.title}</Title>
          {channel.platform && channel.platform !== 'TELEGRAM' && (
            <Chip mode="mono">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <PlatformIcon platform={channel.platform} />
                {channel.platform.charAt(0) + channel.platform.slice(1).toLowerCase()}
              </span>
            </Chip>
          )}
        </div>
        {channel.username && (
          <Text style={{ color: 'var(--tgui--hint_color)' }}>@{channel.username}</Text>
        )}
        {channel.description && (
          <Text style={{ color: 'var(--tgui--hint_color)', display: 'block', marginTop: '4px' }}>
            {channel.description}
          </Text>
        )}
      </div>

      {isOwner && (
        <div
          onClick={() => navigate(`/my-channels/${channel.id}`)}
          style={{
            margin: '0 16px 12px', padding: '12px 16px', borderRadius: '10px',
            background: 'rgba(0, 122, 255, 0.08)', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <Text style={{ color: 'var(--tgui--link_color)', fontSize: '14px', fontWeight: 600 }}>
            This is your channel
          </Text>
          <Chip mode="elevated" style={{ cursor: 'pointer' }}>Manage</Chip>
        </div>
      )}

      {/* Stat cards grid */}
      <div className="stat-grid stat-grid--three" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-card__value">{channel.subscribers.toLocaleString()}</div>
          <div className="stat-card__label">Subscribers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{channel.avgViews.toLocaleString()}</div>
          <div className="stat-card__label">Avg Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{channel.avgReach.toLocaleString()}</div>
          <div className="stat-card__label">Avg Reach</div>
        </div>
      </div>

      {/* Premium % badge */}
      {Number(channel.premiumPercentage) > 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <Chip mode="elevated">{Number(channel.premiumPercentage).toFixed(1)}% Premium</Chip>
        </div>
      )}

      {/* Language breakdown */}
      {channel.languageStats?.length > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'var(--tgui--hint_color)' }}>
            Audience Languages
          </Text>
          {channel.languageStats.map((lang: any) => (
            <div key={lang.language} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Text style={{ fontSize: '13px', minWidth: '40px' }}>{lang.language}</Text>
              <div style={{
                flex: 1, height: '8px', borderRadius: '4px',
                backgroundColor: 'var(--tgui--secondary_bg_color)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, Number(lang.percentage))}%`,
                  height: '100%',
                  borderRadius: '4px',
                  backgroundColor: 'var(--tgui--link_color)',
                }} />
              </div>
              <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', minWidth: '36px', textAlign: 'right' }}>
                {Number(lang.percentage).toFixed(1)}%
              </Text>
            </div>
          ))}
        </div>
      )}

      {/* Refresh stats button (owner only) */}
      {isOwner && (
        <div style={{ padding: '0 16px 12px' }}>
          <Button size="s" mode="bezeled" onClick={() => refreshMutation.mutate()} loading={refreshMutation.isPending}>
            Refresh Stats
          </Button>
          {channel.statsUpdatedAt && (
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '11px', marginLeft: '8px' }}>
              Last updated: {new Date(channel.statsUpdatedAt).toLocaleString()}
            </Text>
          )}
        </div>
      )}

      {stats && (
        <div className="stat-grid stat-grid--three" style={{ marginBottom: '16px' }}>
          <div className="stat-card">
            <div className="stat-card__value">{stats.totalDeals}</div>
            <div className="stat-card__label">Total Deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.completedDeals}</div>
            <div className="stat-card__label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.totalRevenueTon}</div>
            <div className="stat-card__label">Revenue (TON)</div>
          </div>
        </div>
      )}

      <Section header="Select an Ad Format">
        {activeFormats.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>
              {'{ }'}
            </div>
            <Text weight="2" style={{ display: 'block', marginBottom: '4px' }}>
              No ad formats available
            </Text>
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px' }}>
              This channel hasn't set up pricing yet. Check back later or contact the owner.
            </Text>
          </div>
        ) : (
          activeFormats.map((format: any) => {
            const isSelected = selectedFormat === format.id;
            return (
              <div
                key={format.id}
                onClick={() => setSelectedFormat(format.id)}
                style={{
                  padding: '14px 16px',
                  margin: '6px 16px',
                  borderRadius: '12px',
                  border: isSelected
                    ? '2px solid var(--tgui--link_color)'
                    : '1.5px solid var(--tgui--outline)',
                  backgroundColor: isSelected
                    ? 'var(--tgui--secondary_bg_color)'
                    : 'var(--tgui--bg_color)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '60px',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ flex: 1, marginRight: '12px' }}>
                  <div style={{
                    fontSize: '15px', fontWeight: 600,
                    color: isSelected ? 'var(--tgui--link_color)' : 'var(--tgui--text_color)',
                  }}>
                    {format.label}
                  </div>
                  {format.description && (
                    <div style={{
                      fontSize: '13px', color: 'var(--tgui--hint_color)',
                      marginTop: '2px', lineHeight: '1.3',
                    }}>
                      {format.description}
                    </div>
                  )}
                </div>
                <Chip mode={isSelected ? 'elevated' : 'mono'}>{format.priceTon} TON</Chip>
              </div>
            );
          })
        )}
      </Section>

      {/* Requirements builder */}
      {selectedFormat && (
        <Section header="Performance Requirements">
          <div style={{ padding: '0 16px 8px' }}>
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px', display: 'block', marginBottom: '12px' }}>
              Set KPIs the creator must meet. If none set, only requires the post stays live.
            </Text>

            {/* Verification window */}
            <div style={{ marginBottom: '12px' }}>
              <Text weight="2" style={{ fontSize: '14px', marginBottom: '6px', display: 'block' }}>Verification Window</Text>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {WINDOW_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    mode={windowPreset === opt.value ? 'elevated' : 'mono'}
                    onClick={() => setWindowPreset(opt.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
              {windowPreset === 0 && (
                <input
                  type="number"
                  placeholder="Hours (1-720)"
                  value={customWindow}
                  onChange={(e) => setCustomWindow(e.target.value)}
                  min={1}
                  max={720}
                  style={{
                    marginTop: '8px', width: '100%', padding: '10px', borderRadius: '10px',
                    border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                    backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                    fontSize: '14px',
                  }}
                />
              )}
            </div>

            {/* Added requirements */}
            {requirements.map((req, i) => {
              const metricLabel = availableMetrics.find((m) => m.value === req.metricType)?.label || req.metricType;
              const needsTarget = req.metricType !== 'POST_EXISTS' && req.metricType !== 'CUSTOM';
              const TARGET_PRESETS = [100, 500, 1000, 5000, 10000, 50000, 100000];

              return (
                <div key={i} style={{
                  padding: '10px 12px', marginBottom: '8px', borderRadius: '10px',
                  backgroundColor: 'var(--tgui--secondary_bg_color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: needsTarget ? '8px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Chip mode="elevated">{metricLabel}</Chip>
                      {!needsTarget && (
                        <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px' }}>
                          {req.metricType === 'POST_EXISTS' ? 'Must stay live' : 'Manual check'}
                        </Text>
                      )}
                    </div>
                    <button
                      onClick={() => removeRequirement(i)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--tgui--destructive_text_color)',
                        fontSize: '16px', cursor: 'pointer', padding: '2px 6px',
                      }}
                    >x</button>
                  </div>
                  {needsTarget && (
                    <div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {TARGET_PRESETS.map((p) => (
                          <Chip
                            key={p}
                            mode={req.targetValue === p ? 'elevated' : 'mono'}
                            onClick={() => updateRequirement(i, 'targetValue', p)}
                            style={{ cursor: 'pointer', fontSize: '12px' }}
                          >
                            {p >= 1000 ? `${p / 1000}K` : p}
                          </Chip>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Custom target"
                          value={TARGET_PRESETS.includes(req.targetValue) ? '' : (req.targetValue || '')}
                          onChange={(e) => updateRequirement(i, 'targetValue', Number(e.target.value))}
                          min={1}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: '8px',
                            border: '1px solid var(--tgui--outline)',
                            backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                            fontSize: '13px',
                          }}
                        />
                        {req.targetValue > 0 && !TARGET_PRESETS.includes(req.targetValue) && (
                          <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color)' }}>
                            = {req.targetValue.toLocaleString()}
                          </Text>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add requirement — metric type chips */}
            {requirements.length < 10 && (
              <div style={{ marginTop: '4px' }}>
                <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '6px', display: 'block' }}>
                  Add a requirement
                </Text>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {availableMetrics.map((m) => {
                    const alreadyAdded = requirements.some((r) => r.metricType === m.value);
                    if (alreadyAdded) return null;
                    return (
                      <Chip
                        key={m.value}
                        mode="mono"
                        onClick={() => {
                          const target = m.value === 'POST_EXISTS' || m.value === 'CUSTOM' ? 1 : 0;
                          setRequirements([...requirements, { metricType: m.value, targetValue: target }]);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        + {m.label}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Creative Brief + Assets */}
      {selectedFormat && (
        <Section header="Creative Brief">
          <div style={{ padding: '0 16px 8px' }}>
            <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              Tell the creator what the ad should contain.
            </Text>
            <textarea
              placeholder="Key messages, talking points, tone, things to avoid..."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                fontSize: '14px', resize: 'vertical', fontFamily: 'inherit',
              }}
            />

            {/* Assets */}
            {!showAssets && assets.length === 0 ? (
              <Button size="s" mode="bezeled" onClick={() => { setShowAssets(true); setAssets([{ label: '', value: '' }]); }} style={{ marginTop: '8px' }}>
                + Add Links / Assets
              </Button>
            ) : (
              <div style={{ marginTop: '10px' }}>
                <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  Links and Assets
                </Text>
                {assets.map((asset, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px',
                  }}>
                    <input
                      placeholder="Label"
                      value={asset.label}
                      onChange={(e) => {
                        const updated = [...assets];
                        updated[i] = { ...updated[i], label: e.target.value };
                        setAssets(updated);
                      }}
                      style={{
                        width: '90px', padding: '8px', borderRadius: '8px', flexShrink: 0,
                        border: '1px solid var(--tgui--outline)',
                        backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                        fontSize: '13px',
                      }}
                    />
                    <input
                      placeholder="URL, code, or text"
                      value={asset.value}
                      onChange={(e) => {
                        const updated = [...assets];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setAssets(updated);
                      }}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px',
                        border: '1px solid var(--tgui--outline)',
                        backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                      style={{
                        background: 'none', border: 'none', color: 'var(--tgui--destructive_text_color)',
                        fontSize: '16px', cursor: 'pointer', padding: '4px',
                      }}
                    >x</button>
                  </div>
                ))}
                {assets.length < 10 && (
                  <Button size="s" mode="bezeled" onClick={() => setAssets([...assets, { label: '', value: '' }])} style={{ marginTop: '4px' }}>
                    + Add
                  </Button>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {activeFormats.length > 0 && (
        <div style={{ padding: '16px' }}>
          <Button
            size="l"
            stretched
            onClick={handleCreateDeal}
            loading={dealMutation.isPending}
            disabled={!selectedFormat}
            style={{ opacity: selectedFormat ? 1 : 0.4 }}
          >
            {selectedFormat ? 'Create Deal' : 'Select a format above'}
          </Button>
        </div>
      )}

      {dealMutation.isError && (
        <div className="callout callout--error">
          {(dealMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}

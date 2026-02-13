import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Button, Chip, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchChannel, updateChannel, updateAdFormat, addAdFormat, deleteAdFormat, generateVerificationToken, checkVerification, syncChannelAdmins, refreshChannelStats } from '../api/client.js';

const PLATFORM_FORMATS: Record<string, { value: string; label: string; desc: string }[]> = {
  TELEGRAM: [
    { value: 'POST', label: 'Post', desc: 'Sponsored post in the channel' },
    { value: 'FORWARD', label: 'Forward', desc: 'Forward a message to the channel' },
    { value: 'STORY', label: 'Story', desc: 'Channel story (24h visibility)' },
    { value: 'CUSTOM', label: 'Custom', desc: 'Custom ad placement' },
  ],
  YOUTUBE: [
    { value: 'VIDEO', label: 'Video', desc: 'Dedicated sponsored video' },
    { value: 'COMMUNITY_POST', label: 'Community Post', desc: 'Sponsored community tab post' },
    { value: 'CUSTOM', label: 'Custom', desc: 'Custom ad placement' },
  ],
  INSTAGRAM: [
    { value: 'POST', label: 'Post', desc: 'Sponsored feed post' },
    { value: 'STORY', label: 'Story', desc: 'Sponsored story (24h)' },
    { value: 'REEL', label: 'Reel', desc: 'Sponsored reel' },
    { value: 'CUSTOM', label: 'Custom', desc: 'Custom ad placement' },
  ],
  TWITTER: [
    { value: 'TWEET', label: 'Tweet', desc: 'Sponsored tweet' },
    { value: 'CUSTOM', label: 'Custom', desc: 'Custom ad placement' },
  ],
  TIKTOK: [
    { value: 'VIDEO', label: 'Video', desc: 'Sponsored TikTok video' },
    { value: 'STORY', label: 'Story', desc: 'Sponsored TikTok story (24h)' },
    { value: 'CUSTOM', label: 'Custom', desc: 'Custom ad placement' },
  ],
};

const PRICE_PRESETS = [0.5, 1, 2, 5, 10, 25, 50, 100];

export function ManageChannel() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [verifyData, setVerifyData] = useState<{ token: string; verifyUrl: string; instructions: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean } | null>(null);

  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => fetchChannel(Number(id)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['channel', id] });
    queryClient.invalidateQueries({ queryKey: ['my-channels'] });
  };

  const tokenMutation = useMutation({
    mutationFn: () => generateVerificationToken(Number(id)),
    onSuccess: (data) => { setVerifyData(data); setVerifyResult(null); },
  });

  const checkMutation = useMutation({
    mutationFn: () => checkVerification(Number(id)),
    onSuccess: (data) => {
      setVerifyResult(data);
      if (data.verified) invalidate();
    },
  });

  const titleMutation = useMutation({
    mutationFn: (title: string) => updateChannel(Number(id), { title }),
    onSuccess: () => { invalidate(); setEditingTitle(false); },
  });

  // Bulk-add all platform default formats when none exist
  const bulkAddMutation = useMutation({
    mutationFn: async (formats: { formatType: string; label: string; description: string }[]) => {
      for (const fmt of formats) {
        await addAdFormat(Number(id), {
          formatType: fmt.formatType,
          label: fmt.label,
          description: fmt.description,
          priceTon: 0,
        });
      }
    },
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: ({ formatId, data }: { formatId: number; data: any }) =>
      updateAdFormat(Number(id), formatId, data),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ formatId, isActive }: { formatId: number; isActive: boolean }) =>
      updateAdFormat(Number(id), formatId, { isActive }),
    onSuccess: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => addAdFormat(Number(id), data),
    onSuccess: () => { invalidate(); setShowAdd(false); setAddType(''); setAddPrice(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: (formatId: number) => deleteAdFormat(Number(id), formatId),
    onSuccess: invalidate,
  });

  const syncAdminsMutation = useMutation({
    mutationFn: () => syncChannelAdmins(Number(id)),
    onSuccess: invalidate,
  });

  const refreshStatsMutation = useMutation({
    mutationFn: () => refreshChannelStats(Number(id)),
    onSuccess: invalidate,
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (!channel) return <Placeholder header="Channel not found" />;

  const platform = channel.platform || 'TELEGRAM';
  const availableFormats = PLATFORM_FORMATS[platform] || PLATFORM_FORMATS.TELEGRAM;
  const existingTypes = (channel.adFormats || []).map((f: any) => f.formatType);
  const addableFormats = availableFormats.filter((f) => !existingTypes.includes(f.value));

  const liveCount = (channel.adFormats || []).filter((f: any) => f.isActive).length;
  const draftCount = (channel.adFormats || []).length - liveCount;

  const handleAdd = () => {
    const fmt = availableFormats.find((f) => f.value === addType);
    if (!fmt || !addPrice) return;
    addMutation.mutate({
      formatType: fmt.value,
      label: fmt.label,
      description: fmt.desc,
      priceTon: Number(addPrice),
    });
  };

  const startEdit = (format: any) => {
    setEditingId(format.id);
    setEditPrice(String(format.priceTon));
  };

  const savePrice = (formatId: number) => {
    saveMutation.mutate({ formatId, data: { priceTon: Number(editPrice) } });
  };

  return (
    <div>
      <div className="page-header">
        {editingTitle ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              autoFocus
              style={{
                flex: 1, padding: '6px 10px', borderRadius: '8px',
                border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                fontSize: '18px', fontWeight: 700,
              }}
            />
            <Button size="s" onClick={() => titleMutation.mutate(titleInput.trim())}
              loading={titleMutation.isPending} disabled={!titleInput.trim()}>
              Save
            </Button>
            <Button size="s" mode="bezeled" onClick={() => setEditingTitle(false)}>Cancel</Button>
          </div>
        ) : (
          <Title level="2" weight="1"
            onClick={() => { setTitleInput(channel.title); setEditingTitle(true); }}
            style={{ cursor: 'pointer' }}>
            {channel.title}
            <span style={{ fontSize: '12px', color: 'var(--tgui--link_color)', fontWeight: 400, marginLeft: '6px' }}>Edit</span>
          </Title>
        )}
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          {liveCount} live{draftCount > 0 ? `, ${draftCount} draft` : ''}
          {' \u00B7 '}{platform.charAt(0) + platform.slice(1).toLowerCase()}
        </Text>
      </div>

      {/* Verification status */}
      {platform !== 'TELEGRAM' && (
        <Section header="Account Verification">
          <div style={{ padding: '12px 16px' }}>
            {channel.isVerified ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', color: 'var(--tgui--link_color)' }}>&#10003;</span>
                <Text weight="2" style={{ color: 'var(--tgui--link_color)' }}>Verified</Text>
                {channel.verifiedAt && (
                  <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px' }}>
                    {new Date(channel.verifiedAt).toLocaleDateString()}
                  </Text>
                )}
              </div>
            ) : (
              <div>
                <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                  Verify you own this account by adding a link to your profile.
                  Verified accounts rank higher in search results.
                </Text>

                {!verifyData ? (
                  <Button size="s" mode="bezeled" onClick={() => tokenMutation.mutate()} loading={tokenMutation.isPending}>
                    Start Verification
                  </Button>
                ) : (
                  <div style={{
                    padding: '12px', borderRadius: '10px',
                    backgroundColor: 'var(--tgui--secondary_bg_color)',
                    border: '1px solid var(--tgui--outline)',
                  }}>
                    <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                      Step 1: Add this link to your profile
                    </Text>
                    <div style={{
                      padding: '8px 12px', borderRadius: '8px',
                      backgroundColor: 'var(--tgui--bg_color)',
                      fontFamily: 'monospace', fontSize: '12px',
                      wordBreak: 'break-all', marginBottom: '8px',
                    }}>
                      {verifyData.verifyUrl}
                    </div>
                    <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                      {verifyData.instructions}
                    </Text>

                    <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                      Step 2: Check verification
                    </Text>
                    <Button size="s" onClick={() => checkMutation.mutate()} loading={checkMutation.isPending}>
                      Check Now
                    </Button>

                    {verifyResult && !verifyResult.verified && (
                      <div className="callout callout--error" style={{ marginTop: '8px' }}>
                        Link not found in your profile yet. Make sure it's public and try again.
                      </div>
                    )}
                    {verifyResult?.verified && (
                      <div className="callout callout--success" style={{ marginTop: '8px' }}>
                        Account verified! Your channel now shows a verified badge.
                      </div>
                    )}
                  </div>
                )}

                {tokenMutation.isError && (
                  <div className="callout callout--error" style={{ marginTop: '8px' }}>
                    {(tokenMutation.error as Error).message}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Channel Stats */}
      <div className="stat-grid stat-grid--three" style={{ margin: '0 16px 12px' }}>
        <div className="stat-card">
          <div className="stat-card__value">{(channel.subscribers || 0).toLocaleString()}</div>
          <div className="stat-card__label">Subscribers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{(channel.avgViews || 0).toLocaleString()}</div>
          <div className="stat-card__label">Avg Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{(channel.avgReach || 0).toLocaleString()}</div>
          <div className="stat-card__label">Avg Reach</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <Button size="s" mode="bezeled" onClick={() => refreshStatsMutation.mutate()} loading={refreshStatsMutation.isPending}>
          Refresh Stats
        </Button>
        {channel.statsUpdatedAt && (
          <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '11px', marginLeft: '8px' }}>
            Updated: {new Date(channel.statsUpdatedAt).toLocaleString()}
          </Text>
        )}
      </div>

      {/* Channel Admins */}
      {platform === 'TELEGRAM' && (
        <Section header="Channel Admins">
          <div style={{ padding: '12px 16px' }}>
            {(channel.admins || []).length === 0 ? (
              <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                No admins synced yet. Sync from Telegram to let other admins manage deals.
              </Text>
            ) : (
              <div style={{ marginBottom: '10px' }}>
                {(channel.admins || []).map((admin: any) => (
                  <div key={admin.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', marginBottom: '4px', borderRadius: '8px',
                    backgroundColor: 'var(--tgui--secondary_bg_color)',
                  }}>
                    <div>
                      <Text weight="2" style={{ fontSize: '14px' }}>
                        {admin.user?.username ? `@${admin.user.username}` : admin.user?.firstName || `User #${admin.userId}`}
                      </Text>
                      <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', display: 'block' }}>
                        {[
                          admin.canManageDeals && 'Deals',
                          admin.canManagePricing && 'Pricing',
                        ].filter(Boolean).join(', ') || 'No permissions'}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button size="s" mode="bezeled" onClick={() => syncAdminsMutation.mutate()} loading={syncAdminsMutation.isPending}>
              Sync Admins from Telegram
            </Button>
            {syncAdminsMutation.isError && (
              <div className="callout callout--error" style={{ marginTop: '8px' }}>
                {(syncAdminsMutation.error as Error).message}
              </div>
            )}
            {syncAdminsMutation.data && (
              <div className="callout callout--success" style={{ marginTop: '8px' }}>
                Synced {syncAdminsMutation.data.synced} admin(s)
              </div>
            )}
          </div>
        </Section>
      )}

      {liveCount === 0 && (
        <div className="callout callout--warning" style={{ margin: '0 16px 12px' }}>
          No live formats. Set a price and toggle to Live for your channel to appear in the marketplace.
        </div>
      )}

      {/* Existing formats */}
      <Section header="Ad Formats">
        {(channel.adFormats || []).length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <Text style={{ color: 'var(--tgui--hint_color)', display: 'block', marginBottom: '12px' }}>
              No ad formats yet. Add the default formats for {platform.charAt(0) + platform.slice(1).toLowerCase()} to get started.
            </Text>
            <Button
              size="m"
              onClick={() => bulkAddMutation.mutate(availableFormats.map((f) => ({
                formatType: f.value,
                label: f.label,
                description: f.desc,
              })))}
              loading={bulkAddMutation.isPending}
            >
              Add All {platform.charAt(0) + platform.slice(1).toLowerCase()} Formats
            </Button>
          </div>
        )}

        {(channel.adFormats || []).map((format: any) => {
          const isEditing = editingId === format.id;

          return (
            <div key={format.id} style={{
              padding: '14px 16px', margin: '6px 16px', borderRadius: '12px',
              backgroundColor: 'var(--tgui--secondary_bg_color)',
              border: format.isActive
                ? '1.5px solid var(--tgui--link_color)'
                : '1.5px solid var(--tgui--outline)',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text weight="2" style={{ fontSize: '15px' }}>{format.label}</Text>
                  {format.description && (
                    <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                      {format.description}
                    </Text>
                  )}
                </div>
                <Chip
                  mode={format.isActive ? 'elevated' : 'mono'}
                  onClick={() => {
                    if (!format.isActive && Number(format.priceTon) <= 0) {
                      startEdit(format);
                      return;
                    }
                    toggleMutation.mutate({ formatId: format.id, isActive: !format.isActive });
                  }}
                  style={{ cursor: 'pointer', minWidth: '52px', textAlign: 'center' }}
                >
                  {format.isActive ? 'Live' : 'Draft'}
                </Chip>
              </div>

              {/* Price row */}
              <div style={{ marginTop: '10px' }}>
                {isEditing ? (
                  <div>
                    <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '6px', display: 'block' }}>
                      Set price (TON)
                    </Text>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {PRICE_PRESETS.map((p) => (
                        <Chip
                          key={p}
                          mode={editPrice === String(p) ? 'elevated' : 'mono'}
                          onClick={() => setEditPrice(String(p))}
                          style={{ cursor: 'pointer' }}
                        >
                          {p}
                        </Chip>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        min={0}
                        step={0.1}
                        placeholder="Custom"
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: '10px',
                          border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                          backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                          fontSize: '14px',
                        }}
                      />
                      <Text weight="2" style={{ flexShrink: 0 }}>TON</Text>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <Button size="s" onClick={() => savePrice(format.id)} loading={saveMutation.isPending}
                        disabled={!editPrice || Number(editPrice) <= 0}>
                        Save
                      </Button>
                      <Button size="s" mode="bezeled" onClick={() => setEditingId(null)}>Cancel</Button>
                      <div style={{ flex: 1 }} />
                      <Button size="s" mode="plain"
                        onClick={() => { if (confirm('Delete this format?')) deleteMutation.mutate(format.id); }}
                        style={{ color: 'var(--tgui--destructive_text_color)' }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit(format)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <Text style={{ fontSize: '20px', fontWeight: 700 }}>
                      {Number(format.priceTon) > 0 ? `${format.priceTon} TON` : (
                        <span style={{ color: 'var(--tgui--destructive_text_color)', fontSize: '14px', fontWeight: 500 }}>
                          Tap to set price
                        </span>
                      )}
                    </Text>
                    <Text style={{ color: 'var(--tgui--link_color)', fontSize: '13px' }}>Edit</Text>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      {/* Add new format */}
      {addableFormats.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          {!showAdd ? (
            <Button size="m" mode="bezeled" stretched onClick={() => { setShowAdd(true); setAddType(addableFormats[0]?.value || ''); }}>
              + Add Format
            </Button>
          ) : (
            <div style={{
              padding: '16px', borderRadius: '12px',
              backgroundColor: 'var(--tgui--secondary_bg_color)',
              border: '1.5px solid var(--tgui--outline)',
            }}>
              <Text weight="2" style={{ display: 'block', marginBottom: '10px', fontSize: '15px' }}>
                Add Format
              </Text>

              {/* Type picker as chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {addableFormats.map((f) => (
                  <Chip
                    key={f.value}
                    mode={addType === f.value ? 'elevated' : 'mono'}
                    onClick={() => setAddType(f.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>

              {addType && (
                <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                  {availableFormats.find((f) => f.value === addType)?.desc}
                </Text>
              )}

              {/* Price picker */}
              <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '6px', display: 'block' }}>
                Price (TON)
              </Text>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {PRICE_PRESETS.map((p) => (
                  <Chip
                    key={p}
                    mode={addPrice === String(p) ? 'elevated' : 'mono'}
                    onClick={() => setAddPrice(String(p))}
                    style={{ cursor: 'pointer' }}
                  >
                    {p}
                  </Chip>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <input
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  min={0.01}
                  step={0.1}
                  placeholder="Or type custom price"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '10px',
                    border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                    backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                    fontSize: '14px',
                  }}
                />
                <Text weight="2" style={{ flexShrink: 0 }}>TON</Text>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button size="s" onClick={handleAdd} loading={addMutation.isPending}
                  disabled={!addType || !addPrice || Number(addPrice) <= 0}>
                  Add
                </Button>
                <Button size="s" mode="bezeled" onClick={() => { setShowAdd(false); setAddType(''); setAddPrice(''); }}>
                  Cancel
                </Button>
              </div>

              {addMutation.isError && (
                <div className="callout callout--error" style={{ margin: '8px 0 0' }}>
                  {(addMutation.error as Error).message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(saveMutation.isError || deleteMutation.isError || toggleMutation.isError) && (
        <div className="callout callout--error">
          {((saveMutation.error || deleteMutation.error || toggleMutation.error) as Error).message}
        </div>
      )}
    </div>
  );
}

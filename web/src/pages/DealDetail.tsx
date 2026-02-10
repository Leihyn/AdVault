import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDeal,
  payDeal,
  cancelDeal,
  submitCreative,
  approveCreative,
  requestRevision,
  schedulePost,
} from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';
import { CreativeEditor } from '../components/CreativeEditor.js';
import { useTelegram } from '../hooks/useTelegram.js';

export function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useTelegram();
  const queryClient = useQueryClient();
  const [revisionNotes, setRevisionNotes] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => fetchDeal(Number(id)),
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deal', id] });

  const payMutation = useMutation({ mutationFn: () => payDeal(Number(id)), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: () => cancelDeal(Number(id)), onSuccess: invalidate });
  const creativeMutation = useMutation({
    mutationFn: (data: any) => submitCreative(Number(id), data),
    onSuccess: invalidate,
  });
  const approveMutation = useMutation({ mutationFn: () => approveCreative(Number(id)), onSuccess: invalidate });
  const revisionMutation = useMutation({
    mutationFn: () => requestRevision(Number(id), revisionNotes),
    onSuccess: invalidate,
  });
  const scheduleMutation = useMutation({
    mutationFn: () => schedulePost(Number(id), new Date(scheduleDate).toISOString()),
    onSuccess: invalidate,
  });

  if (isLoading) return <p>Loading...</p>;
  if (!deal) return <p>Deal not found</p>;

  const isAdvertiser = user && deal.advertiser?.telegramId?.toString() === user.id.toString();
  const latestCreative = deal.creatives?.[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Deal #{deal.id}</h1>
        <DealStatusBadge status={deal.status} />
      </div>

      <div style={sectionStyle}>
        <div style={rowStyle}><span style={labelStyle}>Channel</span><span>{deal.channel?.title}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Format</span><span>{deal.adFormat?.label}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Amount</span><span>{deal.amountTon} TON</span></div>
        {deal.escrowAddress && (
          <div style={rowStyle}>
            <span style={labelStyle}>Escrow</span>
            <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{deal.escrowAddress}</span>
          </div>
        )}
      </div>

      {/* PENDING_PAYMENT — show pay button for advertiser */}
      {deal.status === 'PENDING_PAYMENT' && isAdvertiser && (
        <div style={sectionStyle}>
          <h2 style={h2Style}>Payment</h2>
          {payMutation.data?.address ? (
            <div>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                Send exactly <strong>{deal.amountTon} TON</strong> to:
              </p>
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
                fontSize: '12px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
              }}>
                {payMutation.data.address}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color)', marginTop: '8px' }}>
                Payment is automatically detected. This page refreshes every 10s.
              </p>
            </div>
          ) : (
            <button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} style={btnStyle}>
              {payMutation.isPending ? 'Loading...' : 'Get Payment Address'}
            </button>
          )}
        </div>
      )}

      {/* CREATIVE_PENDING / CREATIVE_REVISION — show editor for owner */}
      {['CREATIVE_PENDING', 'CREATIVE_REVISION'].includes(deal.status) && !isAdvertiser && (
        <div style={sectionStyle}>
          <h2 style={h2Style}>Submit Creative</h2>
          {latestCreative?.reviewerNotes && (
            <div style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: '#fff3cd',
              color: '#856404',
              fontSize: '13px',
              marginBottom: '12px',
            }}>
              Revision notes: {latestCreative.reviewerNotes}
            </div>
          )}
          <CreativeEditor
            onSubmit={(data) => creativeMutation.mutate(data)}
            loading={creativeMutation.isPending}
            initial={latestCreative ? { contentText: latestCreative.contentText, mediaUrl: latestCreative.mediaUrl } : undefined}
          />
        </div>
      )}

      {/* CREATIVE_SUBMITTED — show approve/revision for advertiser */}
      {deal.status === 'CREATIVE_SUBMITTED' && isAdvertiser && latestCreative && (
        <div style={sectionStyle}>
          <h2 style={h2Style}>Review Creative</h2>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', marginBottom: '12px' }}>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{latestCreative.contentText}</p>
            {latestCreative.mediaUrl && (
              <img src={latestCreative.mediaUrl} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }} alt="creative" />
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} style={{ ...btnStyle, flex: 1 }}>
              Approve
            </button>
            <button
              onClick={() => {
                if (revisionNotes) revisionMutation.mutate();
              }}
              disabled={revisionMutation.isPending || !revisionNotes}
              style={{ ...btnStyle, flex: 1, backgroundColor: '#f0ad4e' }}
            >
              Request Revision
            </button>
          </div>
          <input
            type="text"
            placeholder="Revision notes..."
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            style={{ ...inputStyle, marginTop: '8px' }}
          />
        </div>
      )}

      {/* CREATIVE_APPROVED — show schedule for either party */}
      {deal.status === 'CREATIVE_APPROVED' && (
        <div style={sectionStyle}>
          <h2 style={h2Style}>Schedule Post</h2>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => scheduleMutation.mutate()}
            disabled={scheduleMutation.isPending || !scheduleDate}
            style={{ ...btnStyle, marginTop: '8px' }}
          >
            {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      )}

      {/* Event history */}
      {deal.events?.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={h2Style}>History</h2>
          {deal.events.map((event: any) => (
            <div key={event.id} style={{ fontSize: '13px', marginBottom: '6px', color: 'var(--tg-theme-hint-color)' }}>
              <span>{new Date(event.createdAt).toLocaleString()}</span>{' '}
              <span>{event.eventType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cancel button for active deals */}
      {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'].includes(deal.status) && (
        <button
          onClick={() => { if (confirm('Cancel this deal?')) cancelMutation.mutate(); }}
          disabled={cancelMutation.isPending}
          style={{ ...btnStyle, backgroundColor: '#d9534f', marginTop: '16px' }}
        >
          Cancel Deal
        </button>
      )}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  borderRadius: '12px',
  backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
};
const h2Style: React.CSSProperties = { fontSize: '16px', fontWeight: 600, marginBottom: '8px' };
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px' };
const labelStyle: React.CSSProperties = { color: 'var(--tg-theme-hint-color, #999)' };
const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--tg-theme-hint-color, #ccc)',
  backgroundColor: 'var(--tg-theme-bg-color, #fff)',
  color: 'var(--tg-theme-text-color, #000)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

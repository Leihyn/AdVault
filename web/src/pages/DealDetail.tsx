import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Section, Cell, Button, Input, Placeholder, Spinner, Title, Text,
} from '@telegram-apps/telegram-ui';
import {
  fetchDeal, payDeal, cancelDeal, submitCreative,
  approveCreative, requestRevision, schedulePost,
} from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';
import { CreativeEditor } from '../components/CreativeEditor.js';
import { useTelegram } from '../hooks/useTelegram.js';

const DEAL_STEPS = [
  { key: 'PENDING_PAYMENT', label: 'Pay' },
  { key: 'FUNDED', label: 'Funded' },
  { key: 'CREATIVE', label: 'Creative' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'POSTED', label: 'Posted' },
  { key: 'COMPLETED', label: 'Done' },
];

const STATUS_TO_STEP: Record<string, number> = {
  PENDING_PAYMENT: 0,
  FUNDED: 1,
  CREATIVE_PENDING: 2,
  CREATIVE_SUBMITTED: 2,
  CREATIVE_REVISION: 2,
  CREATIVE_APPROVED: 3,
  SCHEDULED: 4,
  POSTED: 5,
  VERIFIED: 6,
  COMPLETED: 6,
  CANCELLED: -1,
  REFUNDED: -1,
  DISPUTED: -1,
  TIMED_OUT: -1,
};

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

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (!deal) return <Placeholder header="Deal not found" />;

  const isAdvertiser = user && deal.advertiser?.telegramId?.toString() === user.id.toString();
  const latestCreative = deal.creatives?.[0];
  const currentStep = STATUS_TO_STEP[deal.status] ?? -1;
  const isCancelled = currentStep === -1;

  return (
    <div>
      <div className="page-header--row">
        <Title level="2" weight="1">Deal #{deal.id}</Title>
        <DealStatusBadge status={deal.status} />
      </div>

      {/* Progress steps */}
      {!isCancelled && (
        <div className="deal-steps">
          {DEAL_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <div className={`deal-step__line${i <= currentStep ? ' deal-step__line--done' : ''}`} />
              )}
              <div className="deal-step">
                <div className={`deal-step__dot${
                  i < currentStep ? ' deal-step__dot--done' :
                  i === currentStep ? ' deal-step__dot--active' : ''
                }`} />
                <div className={`deal-step__label${i === currentStep ? ' deal-step__label--active' : ''}`}>
                  {step.label}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      <Section header="Details">
        <Cell after={<Text>{deal.channel?.title}</Text>}>Channel</Cell>
        <Cell after={<Text>{deal.adFormat?.label}</Text>}>Format</Cell>
        <Cell after={<Text weight="1">{deal.amountTon} TON</Text>}>Amount</Cell>
        {deal.escrowAddress && (
          <Cell multiline>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Text>Escrow</Text>
              <div className="address-block">{deal.escrowAddress}</div>
            </div>
          </Cell>
        )}
      </Section>

      {/* PENDING_PAYMENT - show pay button for advertiser */}
      {deal.status === 'PENDING_PAYMENT' && isAdvertiser && (
        <Section header="Payment">
          {payMutation.data?.address ? (
            <div style={{ padding: '16px' }}>
              <Text>Send exactly <strong>{deal.amountTon} TON</strong> to:</Text>
              <div className="address-block">{payMutation.data.address}</div>
              <div className="callout callout--info" style={{ margin: '12px 0 0' }}>
                Payment is automatically detected. This page refreshes every 10s.
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              <Button size="l" stretched onClick={() => payMutation.mutate()} loading={payMutation.isPending}>
                Get Payment Address
              </Button>
            </div>
          )}
        </Section>
      )}

      {/* CREATIVE_PENDING / CREATIVE_REVISION - show editor for owner */}
      {['CREATIVE_PENDING', 'CREATIVE_REVISION'].includes(deal.status) && !isAdvertiser && (
        <Section header="Submit Creative">
          {latestCreative?.reviewerNotes && (
            <div className="callout callout--warning">
              Revision notes: {latestCreative.reviewerNotes}
            </div>
          )}
          <div style={{ padding: '16px' }}>
            <CreativeEditor
              onSubmit={(data) => creativeMutation.mutate(data)}
              loading={creativeMutation.isPending}
              initial={latestCreative ? { contentText: latestCreative.contentText, mediaUrl: latestCreative.mediaUrl } : undefined}
            />
          </div>
        </Section>
      )}

      {/* CREATIVE_SUBMITTED - show approve/revision for advertiser */}
      {deal.status === 'CREATIVE_SUBMITTED' && isAdvertiser && latestCreative && (
        <Section header="Review Creative">
          <div style={{ padding: '16px' }}>
            <div style={{
              padding: '12px', borderRadius: '10px',
              backgroundColor: 'var(--tgui--secondary_bg_color)', marginBottom: '12px',
            }}>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{latestCreative.contentText}</Text>
              {latestCreative.mediaUrl && (
                <img src={latestCreative.mediaUrl} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }} alt="creative" />
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <Button size="m" stretched onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
                Approve
              </Button>
              <Button
                size="m"
                stretched
                mode="bezeled"
                onClick={() => { if (revisionNotes) revisionMutation.mutate(); }}
                loading={revisionMutation.isPending}
                disabled={!revisionNotes}
              >
                Request Revision
              </Button>
            </div>
            <Input
              placeholder="Revision notes..."
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
            />
          </div>
        </Section>
      )}

      {/* CREATIVE_APPROVED - show schedule */}
      {deal.status === 'CREATIVE_APPROVED' && (
        <Section header="Schedule Post">
          <div style={{ padding: '16px' }}>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                fontSize: '14px', marginBottom: '8px',
              }}
            />
            <Button
              size="l"
              stretched
              onClick={() => scheduleMutation.mutate()}
              loading={scheduleMutation.isPending}
              disabled={!scheduleDate}
            >
              Schedule
            </Button>
          </div>
        </Section>
      )}

      {/* Event history */}
      {deal.events?.length > 0 && (
        <Section header="History">
          {deal.events.map((event: any) => (
            <Cell key={event.id} subtitle={new Date(event.createdAt).toLocaleString()}>
              {event.eventType.replace(/_/g, ' ')}
            </Cell>
          ))}
        </Section>
      )}

      {/* Cancel button for active deals */}
      {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'TIMED_OUT'].includes(deal.status) && (
        <div style={{ padding: '16px' }}>
          <Button
            size="l"
            stretched
            mode="bezeled"
            loading={cancelMutation.isPending}
            onClick={() => { if (confirm('Cancel this deal?')) cancelMutation.mutate(); }}
            style={{ color: 'var(--tgui--destructive_text_color)' }}
          >
            Cancel Deal
          </Button>
        </div>
      )}
    </div>
  );
}

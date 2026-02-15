import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Section, Cell, Button, Input, Placeholder, Spinner, Title, Text,
} from '@telegram-apps/telegram-ui';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import {
  fetchDeal, payDeal, cancelDeal, submitCreative,
  approveCreative, requestRevision, submitPostProof,
  waiveRequirement, confirmRequirement,
  fetchDispute, openDispute, submitDisputeEvidence,
  proposeResolution, acceptProposal, schedulePost,
} from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';
import { CreativeEditor } from '../components/CreativeEditor.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useToast } from '../hooks/useToast.js';

const DEAL_STEPS = [
  { key: 'PENDING_PAYMENT', label: 'Pay' },
  { key: 'FUNDED', label: 'Funded' },
  { key: 'CREATIVE', label: 'Creative' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'POSTED', label: 'Posted' },
  { key: 'TRACKING', label: 'Tracking' },
  { key: 'COMPLETED', label: 'Done' },
];

const STATUS_TO_STEP: Record<string, number> = {
  PENDING_PAYMENT: 0,
  FUNDED: 1,
  CREATIVE_PENDING: 2,
  CREATIVE_SUBMITTED: 2,
  CREATIVE_REVISION: 2,
  CREATIVE_APPROVED: 3,
  POSTED: 4,
  TRACKING: 5,
  VERIFIED: 6,
  COMPLETED: 6,
  FAILED: -1,
  CANCELLED: -1,
  REFUNDED: -1,
  DISPUTED: -1,
  TIMED_OUT: -1,
};

const METRIC_LABELS: Record<string, string> = {
  POST_EXISTS: 'Post Live',
  VIEWS: 'Views',
  LIKES: 'Likes',
  COMMENTS: 'Comments',
  SHARES: 'Shares',
  CUSTOM: 'Custom',
};

const REQ_STATUS_COLORS: Record<string, string> = {
  PENDING: '#FF9500',
  MET: '#34C759',
  FAILED: '#FF3B30',
  WAIVED: '#8E8E93',
};

export function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useTelegram();
  const { showToast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const queryClient = useQueryClient();
  const [revisionNotes, setRevisionNotes] = useState('');
  const [postProofUrl, setPostProofUrl] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const copyAddress = useCallback(async (address: string, event?: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      try { (window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred('success'); } catch {}
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      // Fallback: select the clicked element's text
      const el = (event?.currentTarget ?? document.querySelector('.address-block')) as HTMLElement;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }, []);

  const [tonPayPending, setTonPayPending] = useState(false);

  const sendTonPayment = useCallback(async (address: string, amountTon: string) => {
    if (!wallet) {
      await tonConnectUI.openModal();
      return;
    }
    setTonPayPending(true);
    try {
      // Convert TON to nanotons (1 TON = 1e9 nanotons) using string math to avoid float precision loss
      const [whole = '0', frac = ''] = amountTon.split('.');
      const nanotons = (BigInt(whole) * 1_000_000_000n + BigInt(frac.padEnd(9, '0').slice(0, 9))).toString();
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 min validity
        messages: [
          {
            address,
            amount: nanotons,
          },
        ],
      });
      showToast('Payment sent! Waiting for confirmation...', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Payment cancelled';
      if (!msg.includes('cancel') && !msg.includes('reject')) {
        showToast(msg, 'error');
      }
    } finally {
      setTonPayPending(false);
    }
  }, [wallet, tonConnectUI, showToast]);

  const { data: deal, isLoading, isError } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => fetchDeal(Number(id)),
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deal', id] });

  const payMutation = useMutation({ mutationFn: () => payDeal(Number(id)), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: () => cancelDeal(Number(id)), onSuccess: (data) => { invalidate(); showToast(data?.status === 'REFUNDED' ? 'Deal cancelled — funds refunded' : 'Deal cancelled', 'info'); } });
  const creativeMutation = useMutation({
    mutationFn: (data: any) => submitCreative(Number(id), data),
    onSuccess: () => { invalidate(); showToast('Creative submitted', 'success'); },
    onError: (err: Error) => showToast(err.message || 'Failed to submit creative', 'error'),
  });
  const approveMutation = useMutation({ mutationFn: () => approveCreative(Number(id)), onSuccess: () => { invalidate(); showToast('Creative approved', 'success'); } });
  const revisionMutation = useMutation({
    mutationFn: () => requestRevision(Number(id), revisionNotes),
    onSuccess: invalidate,
  });
  const proofMutation = useMutation({
    mutationFn: () => submitPostProof(Number(id), postProofUrl),
    onSuccess: invalidate,
  });
  const scheduleMutation = useMutation({
    mutationFn: () => schedulePost(Number(id), new Date(scheduledTime).toISOString()),
    onSuccess: invalidate,
  });
  const waiveMutation = useMutation({
    mutationFn: (reqId: number) => waiveRequirement(Number(id), reqId),
    onSuccess: invalidate,
  });
  const confirmMutation = useMutation({
    mutationFn: (reqId: number) => confirmRequirement(Number(id), reqId),
    onSuccess: invalidate,
  });
  const openDisputeMutation = useMutation({
    mutationFn: () => openDispute(Number(id), disputeReason),
    onSuccess: () => { invalidate(); setShowDisputeForm(false); setDisputeReason(''); },
  });
  const evidenceMutation = useMutation({
    mutationFn: () => submitDisputeEvidence(Number(id), evidenceText, evidenceUrl || undefined),
    onSuccess: () => { setEvidenceText(''); setEvidenceUrl(''); queryClient.invalidateQueries({ queryKey: ['dispute', id] }); },
  });
  const proposeMutation = useMutation({
    mutationFn: (outcome: string) => proposeResolution(Number(id), outcome),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['dispute', id] }); },
  });
  const acceptMutation = useMutation({
    mutationFn: () => acceptProposal(Number(id)),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['dispute', id] }); },
  });

  const { data: dispute } = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => fetchDispute(Number(id)),
    enabled: deal?.status === 'DISPUTED',
    refetchInterval: 15_000,
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (isError) return <Placeholder header="Failed to load deal" description="Check your connection and try again." />;
  if (!deal) return <Placeholder header="Deal not found" />;

  const isAdvertiser = deal.isAdvertiser ?? false;
  const isOwner = deal.isOwner ?? false;
  const latestCreative = deal.creatives?.[0];
  const currentStep = STATUS_TO_STEP[deal.status] ?? -1;
  const isCancelled = currentStep === -1;

  // Compute tracking countdown
  const trackingTimeLeft = (() => {
    if (deal.status !== 'TRACKING' || !deal.trackingStartedAt) return null;
    const windowMs = (deal.verificationWindowHours || 24) * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(deal.trackingStartedAt).getTime();
    const remaining = Math.max(0, windowMs - elapsed);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  })();

  return (
    <div>
      <div className="page-header--row">
        <Title level="2" weight="1">Deal #{deal.id}</Title>
        <DealStatusBadge status={deal.status} />
      </div>

      {/* Role indicator */}
      <div style={{ padding: '0 16px 8px' }}>
        <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px' }}>
          {isAdvertiser ? 'You are the advertiser' : isOwner ? 'You are the channel owner' : ''}
          {deal.channel?.title ? ` \u00B7 ${deal.channel.title}` : ''}
          {deal.adFormat?.label ? ` \u00B7 ${deal.adFormat.label}` : ''}
        </Text>
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

      {/* Deal summary cards */}
      <div className="stat-grid" style={{ marginBottom: '12px' }}>
        <div className="stat-card">
          <div className="stat-card__value">{deal.amountTon} TON</div>
          <div className="stat-card__label">Amount</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{deal.verificationWindowHours || 24}h</div>
          <div className="stat-card__label">Verify Window</div>
        </div>
      </div>

      {/* Requirements — always visible */}
      {deal.requirements?.length > 0 && (
        <Section header={deal.status === 'TRACKING' && trackingTimeLeft ? `Requirements (${trackingTimeLeft} left)` : 'Requirements'}>
          {deal.requirements.map((req: any) => {
            const label = METRIC_LABELS[req.metricType] || req.metricType;
            const isTrackingOrLater = ['TRACKING', 'FAILED', 'VERIFIED', 'COMPLETED'].includes(deal.status);
            const progress = !isTrackingOrLater ? 0
              : req.metricType === 'POST_EXISTS'
                ? (req.currentValue >= 1 ? 100 : 0)
                : Math.min(100, Math.round((req.currentValue / req.targetValue) * 100));
            const statusColor = REQ_STATUS_COLORS[req.status] || '#8E8E93';

            return (
              <div key={req.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--tgui--secondary_bg_color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <Text weight="2">{label}</Text>
                  {isTrackingOrLater ? (
                    <Text style={{ color: statusColor, fontSize: '13px', fontWeight: 600 }}>{req.status}</Text>
                  ) : (
                    <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px' }}>
                      {req.metricType === 'POST_EXISTS' ? 'Required' : `Target: ${req.targetValue.toLocaleString()}`}
                    </Text>
                  )}
                </div>
                {isTrackingOrLater && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'var(--tgui--secondary_bg_color)' }}>
                      <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        borderRadius: '3px',
                        backgroundColor: req.status === 'MET' || req.status === 'WAIVED' ? '#34C759' : '#007AFF',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color)', minWidth: '60px', textAlign: 'right' }}>
                      {req.metricType === 'POST_EXISTS' ? (req.currentValue >= 1 ? 'Live' : 'Pending') : `${req.currentValue} / ${req.targetValue}`}
                    </Text>
                  </div>
                )}
                {/* Advertiser actions */}
                {isAdvertiser && ['TRACKING', 'FAILED'].includes(deal.status) && req.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {req.metricType === 'CUSTOM' && (
                      <Button size="s" mode="bezeled" onClick={() => confirmMutation.mutate(req.id)} loading={confirmMutation.isPending}>
                        Confirm
                      </Button>
                    )}
                    <Button size="s" mode="plain" onClick={() => waiveMutation.mutate(req.id)} loading={waiveMutation.isPending}>
                      Waive
                    </Button>
                  </div>
                )}
                {isAdvertiser && deal.status === 'FAILED' && req.status === 'FAILED' && (
                  <div style={{ marginTop: '4px' }}>
                    <Button size="s" mode="plain" onClick={() => waiveMutation.mutate(req.id)} loading={waiveMutation.isPending}>
                      Waive
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {/* Brief + Assets */}
      {(deal.brief || deal.assets?.length > 0) && (
        <Section header="Creative Brief">
          {deal.brief && (
            <div style={{ padding: '12px 16px' }}>
              <Text style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.5' }}>{deal.brief}</Text>
            </div>
          )}
          {deal.assets?.length > 0 && (
            <div style={{ padding: deal.brief ? '0 16px 12px' : '12px 16px' }}>
              <Text weight="2" style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', marginBottom: '6px', display: 'block' }}>
                Links and Assets
              </Text>
              {deal.assets.map((asset: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', gap: '8px', padding: '8px 10px', marginBottom: '4px',
                  borderRadius: '8px', backgroundColor: 'var(--tgui--secondary_bg_color)',
                }}>
                  <Text weight="2" style={{ fontSize: '13px', flexShrink: 0 }}>{asset.label}</Text>
                  <Text style={{
                    fontSize: '13px', color: 'var(--tgui--link_color)',
                    wordBreak: 'break-all', overflow: 'hidden',
                  }}>
                    {asset.value}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Escrow address */}
      {deal.escrowAddress && (
        <Section header="Escrow">
          <Cell multiline>
            <div className="address-block address-block--copyable" onClick={(e) => copyAddress(deal.escrowAddress, e)}>
              {deal.escrowAddress}
              <span className="address-block__hint">{copiedAddress ? 'Copied!' : 'Tap to copy'}</span>
            </div>
          </Cell>
        </Section>
      )}

      {/* PENDING_PAYMENT - show pay button for advertiser */}
      {deal.status === 'PENDING_PAYMENT' && isAdvertiser && (
        <Section header="Payment">
          {payMutation.data?.address ? (
            <div style={{ padding: '16px' }}>
              {/* TON Connect one-tap payment */}
              <Button
                size="l"
                stretched
                onClick={() => sendTonPayment(payMutation.data.address, deal.amountTon)}
                loading={tonPayPending}
                style={{ marginBottom: '12px' }}
              >
                {wallet ? `Pay ${deal.amountTon} TON` : 'Connect Wallet & Pay'}
              </Button>

              <div style={{
                textAlign: 'center', fontSize: '12px', color: 'var(--tgui--hint_color)',
                margin: '4px 0 12px',
              }}>
                or send manually:
              </div>

              <Text>Send exactly <strong>{deal.amountTon} TON</strong> to:</Text>
              <div className="address-block address-block--copyable" onClick={(e) => copyAddress(payMutation.data.address, e)}>
                {payMutation.data.address}
                <span className="address-block__hint">{copiedAddress ? 'Copied!' : 'Tap to copy'}</span>
              </div>
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
      {['CREATIVE_PENDING', 'CREATIVE_REVISION'].includes(deal.status) && isOwner && (
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
            {creativeMutation.isError && (
              <div className="callout callout--error" style={{ marginTop: '8px' }}>
                {(creativeMutation.error as Error).message}
              </div>
            )}
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

      {/* CREATIVE_APPROVED - auto-post scheduler (either party) */}
      {deal.status === 'CREATIVE_APPROVED' && (
        <Section header="Schedule Auto-Post">
          <div style={{ padding: '16px' }}>
            {deal.scheduledPostAt ? (
              <div className="callout callout--info">
                Auto-post scheduled for {new Date(deal.scheduledPostAt).toLocaleString()}
              </div>
            ) : (
              <div>
                <Text style={{ color: 'var(--tgui--hint_color)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Schedule the bot to auto-post the approved creative to the channel.
                </Text>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
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
                  disabled={!scheduledTime}
                >
                  Schedule Auto-Post
                </Button>
                {scheduleMutation.isError && (
                  <div className="callout callout--error" style={{ marginTop: '8px' }}>
                    {(scheduleMutation.error as Error).message}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* CREATIVE_APPROVED - show post proof submission for owner (manual fallback) */}
      {deal.status === 'CREATIVE_APPROVED' && isOwner && (
        <Section header="Or Submit Post Proof Manually">
          <div style={{ padding: '16px' }}>
            <div className="callout callout--info" style={{ marginBottom: '12px' }}>
              Post the ad to your channel, then paste the post URL here to start the verification process.
            </div>
            <Input
              placeholder="https://t.me/channel/123 or YouTube URL..."
              value={postProofUrl}
              onChange={(e) => setPostProofUrl(e.target.value)}
            />
            <Button
              size="l"
              stretched
              onClick={() => proofMutation.mutate()}
              loading={proofMutation.isPending}
              disabled={!postProofUrl}
              style={{ marginTop: '8px' }}
            >
              Submit Proof
            </Button>
            {proofMutation.isError && (
              <div className="callout callout--error" style={{ marginTop: '8px' }}>
                {(proofMutation.error as Error).message}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Post proof URL */}
      {deal.postProofUrl && (
        <Section header="Post Proof">
          <Cell multiline>
            <a href={deal.postProofUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tgui--link_color)', wordBreak: 'break-all' }}>
              {deal.postProofUrl}
            </a>
          </Cell>
        </Section>
      )}

      {/* Dispute section — when deal is disputed */}
      {deal.status === 'DISPUTED' && dispute && (
        <Section header="Dispute">
          <div style={{ padding: '12px 16px' }}>
            {/* Dispute status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Text weight="2">Status</Text>
              <Text style={{
                fontSize: '13px', fontWeight: 600,
                color: dispute.status === 'RESOLVED' ? '#34C759'
                  : dispute.status === 'ADMIN_REVIEW' ? '#FF9500' : '#007AFF',
              }}>
                {dispute.status === 'OPEN' || dispute.status === 'MUTUAL_RESOLUTION' ? 'Awaiting Resolution' :
                  dispute.status === 'ADMIN_REVIEW' ? 'Under Admin Review' : 'Resolved'}
              </Text>
            </div>

            {/* Reason */}
            <div style={{
              padding: '10px 12px', borderRadius: '8px', marginBottom: '12px',
              backgroundColor: 'var(--tgui--secondary_bg_color)',
            }}>
              <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', display: 'block', marginBottom: '4px' }}>Reason</Text>
              <Text style={{ fontSize: '14px' }}>{dispute.reason}</Text>
            </div>

            {/* Countdown to escalation */}
            {['OPEN', 'MUTUAL_RESOLUTION'].includes(dispute.status) && dispute.mutualDeadline && (
              <div className="callout callout--info" style={{ marginBottom: '12px' }}>
                {(() => {
                  const remaining = Math.max(0, new Date(dispute.mutualDeadline).getTime() - Date.now());
                  const hours = Math.floor(remaining / (60 * 60 * 1000));
                  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                  return remaining > 0
                    ? `${hours}h ${minutes}m to reach agreement before admin escalation`
                    : 'Escalating to admin review...';
                })()}
              </div>
            )}

            {/* Proposals */}
            {dispute.status !== 'RESOLVED' && (
              <div style={{ marginBottom: '12px' }}>
                <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Propose Resolution
                </Text>

                {/* Show other party's proposal if exists */}
                {dispute.otherProposal && (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                    backgroundColor: 'var(--tgui--secondary_bg_color)',
                    border: '1px solid var(--tgui--link_color)',
                  }}>
                    <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', display: 'block', marginBottom: '4px' }}>
                      Other party proposes
                    </Text>
                    <Text weight="2" style={{ fontSize: '14px' }}>
                      {dispute.otherProposal === 'RELEASE_TO_OWNER' ? 'Release funds to creator' :
                        dispute.otherProposal === 'REFUND_TO_ADVERTISER' ? 'Refund to advertiser' :
                          `Split ${dispute.otherSplitPercent || 50}% to creator`}
                    </Text>
                    <Button
                      size="s"
                      style={{ marginTop: '8px' }}
                      onClick={() => acceptMutation.mutate()}
                      loading={acceptMutation.isPending}
                    >
                      Accept This Proposal
                    </Button>
                  </div>
                )}

                {/* My proposal status */}
                {dispute.myProposal && (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                    backgroundColor: 'var(--tgui--secondary_bg_color)',
                  }}>
                    <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', display: 'block', marginBottom: '4px' }}>
                      Your proposal
                    </Text>
                    <Text style={{ fontSize: '14px' }}>
                      {dispute.myProposal === 'RELEASE_TO_OWNER' ? 'Release funds to creator' :
                        dispute.myProposal === 'REFUND_TO_ADVERTISER' ? 'Refund to advertiser' : 'Split'}
                    </Text>
                  </div>
                )}

                {/* Proposal buttons */}
                {!dispute.myProposal && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button size="s" mode="bezeled"
                      onClick={() => proposeMutation.mutate('RELEASE_TO_OWNER')}
                      loading={proposeMutation.isPending}>
                      Release to Creator
                    </Button>
                    <Button size="s" mode="bezeled"
                      onClick={() => proposeMutation.mutate('REFUND_TO_ADVERTISER')}
                      loading={proposeMutation.isPending}>
                      Refund to Advertiser
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Resolved outcome */}
            {dispute.status === 'RESOLVED' && dispute.resolvedOutcome && (
              <div style={{
                padding: '12px', borderRadius: '8px', marginBottom: '12px',
                backgroundColor: 'var(--tgui--secondary_bg_color)',
                border: '1.5px solid #34C759',
              }}>
                <Text weight="2" style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Resolved: {dispute.resolvedOutcome === 'RELEASE_TO_OWNER' ? 'Funds released to creator' :
                    dispute.resolvedOutcome === 'REFUND_TO_ADVERTISER' ? 'Funds refunded to advertiser' :
                      `Split ${dispute.resolvedSplitPercent || 50}% to creator`}
                </Text>
                {dispute.resolvedReason && (
                  <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color)' }}>
                    {dispute.resolvedReason}
                  </Text>
                )}
              </div>
            )}

            {/* Evidence */}
            {dispute.evidence?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Evidence ({dispute.evidence.length})
                </Text>
                {dispute.evidence.map((ev: any) => (
                  <div key={ev.id} style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
                    backgroundColor: 'var(--tgui--secondary_bg_color)',
                  }}>
                    <Text style={{ fontSize: '12px', color: 'var(--tgui--hint_color)', display: 'block', marginBottom: '4px' }}>
                      {ev.submittedById === user?.id ? 'You' : 'Other party'} — {new Date(ev.createdAt).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: '14px' }}>{ev.description}</Text>
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--tgui--link_color)', fontSize: '13px', wordBreak: 'break-all' }}>
                        {ev.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit evidence */}
            {dispute.status !== 'RESOLVED' && (
              <div>
                <Text weight="2" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Add Evidence
                </Text>
                <textarea
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="Describe what happened..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                    backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                    fontSize: '14px', resize: 'vertical', marginBottom: '8px',
                  }}
                />
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="Screenshot or proof URL (optional)"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                    backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                    fontSize: '14px', marginBottom: '8px',
                  }}
                />
                <Button size="s" onClick={() => evidenceMutation.mutate()}
                  loading={evidenceMutation.isPending} disabled={!evidenceText.trim()}>
                  Submit Evidence
                </Button>
                {evidenceMutation.isError && (
                  <div className="callout callout--error" style={{ marginTop: '8px' }}>
                    {(evidenceMutation.error as Error).message}
                  </div>
                )}
              </div>
            )}
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

      {/* Action buttons for active deals */}
      {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED', 'TIMED_OUT', 'DISPUTED'].includes(deal.status) && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Dispute button — only for funded deals */}
          {['FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED', 'CREATIVE_REVISION',
            'CREATIVE_APPROVED', 'POSTED', 'TRACKING'].includes(deal.status) && (
            !showDisputeForm ? (
              <Button size="l" stretched mode="bezeled" onClick={() => setShowDisputeForm(true)}>
                Open Dispute
              </Button>
            ) : (
              <div style={{
                padding: '14px', borderRadius: '12px',
                border: '1.5px solid var(--tgui--destructive_text_color)',
                backgroundColor: 'var(--tgui--secondary_bg_color)',
              }}>
                <Text weight="2" style={{ display: 'block', marginBottom: '8px' }}>
                  Describe the issue
                </Text>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="What went wrong? Be specific..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    border: '1px solid var(--tgui--outline)', boxSizing: 'border-box',
                    backgroundColor: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                    fontSize: '14px', resize: 'vertical', marginBottom: '8px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button size="s" onClick={() => openDisputeMutation.mutate()}
                    loading={openDisputeMutation.isPending}
                    disabled={!disputeReason.trim()}
                    style={{ color: 'var(--tgui--destructive_text_color)' }}>
                    Open Dispute
                  </Button>
                  <Button size="s" mode="bezeled" onClick={() => { setShowDisputeForm(false); setDisputeReason(''); }}>
                    Cancel
                  </Button>
                </div>
                {openDisputeMutation.isError && (
                  <div className="callout callout--error" style={{ marginTop: '8px' }}>
                    {(openDisputeMutation.error as Error).message}
                  </div>
                )}
              </div>
            )
          )}

          {/* Cancel button */}
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

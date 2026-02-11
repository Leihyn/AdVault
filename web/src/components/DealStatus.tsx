import React from 'react';
import { Chip } from '@telegram-apps/telegram-ui';

const STATUS_CONFIG: Record<string, { label: string; mode: 'elevated' | 'mono' | 'outline'; color?: string; bg?: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting Payment', mode: 'outline', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
  FUNDED:          { label: 'Funded', mode: 'elevated', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.1)' },
  CREATIVE_PENDING:   { label: 'Awaiting Creative', mode: 'mono' },
  CREATIVE_SUBMITTED: { label: 'Under Review', mode: 'mono', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.1)' },
  CREATIVE_REVISION:  { label: 'Revision Needed', mode: 'outline', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
  CREATIVE_APPROVED:  { label: 'Approved', mode: 'elevated', color: '#34C759', bg: 'rgba(52, 199, 89, 0.1)' },
  SCHEDULED: { label: 'Scheduled', mode: 'mono', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.1)' },
  POSTED:    { label: 'Verifying', mode: 'mono', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.1)' },
  VERIFIED:  { label: 'Verified', mode: 'elevated', color: '#34C759', bg: 'rgba(52, 199, 89, 0.1)' },
  COMPLETED: { label: 'Completed', mode: 'elevated', color: '#34C759', bg: 'rgba(52, 199, 89, 0.12)' },
  CANCELLED: { label: 'Cancelled', mode: 'outline', color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.08)' },
  REFUNDED:  { label: 'Refunded', mode: 'outline', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
  DISPUTED:  { label: 'Disputed', mode: 'outline', color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.1)' },
  TIMED_OUT: { label: 'Timed Out', mode: 'outline', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.1)' },
};

export function DealStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, mode: 'mono' as const };
  const style = config.color
    ? { color: config.color, backgroundColor: config.bg }
    : undefined;

  return (
    <Chip mode={config.mode} style={style}>
      {config.label}
    </Chip>
  );
}

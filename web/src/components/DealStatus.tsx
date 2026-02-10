import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting Payment', color: '#f0ad4e' },
  FUNDED: { label: 'Funded', color: '#5cb85c' },
  CREATIVE_PENDING: { label: 'Awaiting Creative', color: '#5bc0de' },
  CREATIVE_SUBMITTED: { label: 'Creative Under Review', color: '#5bc0de' },
  CREATIVE_REVISION: { label: 'Revision Requested', color: '#f0ad4e' },
  CREATIVE_APPROVED: { label: 'Creative Approved', color: '#5cb85c' },
  SCHEDULED: { label: 'Scheduled', color: '#5bc0de' },
  POSTED: { label: 'Posted (Verifying)', color: '#5bc0de' },
  VERIFIED: { label: 'Verified', color: '#5cb85c' },
  COMPLETED: { label: 'Completed', color: '#5cb85c' },
  CANCELLED: { label: 'Cancelled', color: '#d9534f' },
  REFUNDED: { label: 'Refunded', color: '#999' },
  DISPUTED: { label: 'Disputed', color: '#d9534f' },
  TIMED_OUT: { label: 'Timed Out', color: '#999' },
};

export function DealStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: '#999' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
      color: '#fff',
      backgroundColor: config.color,
    }}>
      {config.label}
    </span>
  );
}

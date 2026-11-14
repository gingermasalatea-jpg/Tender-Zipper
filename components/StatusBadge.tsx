import { Badge } from '@/components/ui';
import type { QuoteStatus, TenderStatus, DocStatus } from '@/lib/types';

const TENDER: Record<TenderStatus, { label: string; tone: 'green' | 'amber' | 'blue' | 'slate' | 'red' | 'purple' }> = {
  open: { label: 'Open for quotes', tone: 'green' },
  closed: { label: 'Quotes closed', tone: 'amber' },
  awarded: { label: 'Awarded', tone: 'blue' },
  completed: { label: 'Completed', tone: 'purple' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};
const QUOTE: Record<QuoteStatus, { label: string; tone: 'green' | 'amber' | 'blue' | 'slate' | 'red' | 'purple' }> = {
  draft: { label: 'Draft', tone: 'slate' },
  submitted: { label: 'Submitted', tone: 'blue' },
  withdrawn: { label: 'Withdrawn', tone: 'slate' },
  shortlisted: { label: 'Shortlisted', tone: 'amber' },
  awarded: { label: 'Awarded', tone: 'green' },
  rejected: { label: 'Not selected', tone: 'red' },
};
const DOC: Record<DocStatus, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  pending: { label: 'Under review', tone: 'amber' },
  verified: { label: 'Verified', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export function TenderStatusBadge({ status }: { status: TenderStatus }) {
  const s = TENDER[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const s = QUOTE[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function DocStatusBadge({ status }: { status: DocStatus }) {
  const s = DOC[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

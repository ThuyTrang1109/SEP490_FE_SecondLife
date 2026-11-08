import { inspectorService } from './inspectorService';
import type { InspectionFeeProposalResponse } from './inspectorService';

type PricingSource = Pick<typeof inspectorService,
  'getTravelTiers' | 'getCurrentLevelFees' | 'getTierProposals' | 'getCenterLevelFeeProposals'>;

function pendingLevelFees(items: InspectionFeeProposalResponse[]) {
  return items.filter((item) => item.complexityLevel && ['PENDING', 'PENDING_APPROVAL'].includes(item.status));
}

/** The two proposal URLs return the same history; reuse a complete first page. */
export async function loadCenterPricing(
  page: number, status: string, includeSummary: boolean, source: PricingSource = inspectorService,
) {
  const [tiers, fees, history] = await Promise.allSettled([
    includeSummary ? source.getTravelTiers() : Promise.resolve(null),
    includeSummary ? source.getCurrentLevelFees() : Promise.resolve(null),
    source.getTierProposals(status, page, 10),
  ]);

  let pending: PromiseSettledResult<InspectionFeeProposalResponse[]> | null = null;
  if (includeSummary) {
    if (history.status === 'fulfilled' && page === 0 && status === 'ALL'
      && history.value.totalElements <= history.value.items.length) {
      pending = { status: 'fulfilled', value: pendingLevelFees(history.value.items) };
    } else {
      // Pending level cards are independent of the history's page/status filter.
      const [result] = await Promise.allSettled([source.getCenterLevelFeeProposals(0, 50, 'PENDING_APPROVAL')]);
      pending = result.status === 'fulfilled'
        ? { status: 'fulfilled', value: pendingLevelFees(result.value.items) }
        : result;
    }
  }
  return { tiers, fees, history, pending };
}

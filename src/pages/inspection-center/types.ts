import { getCenterDispatchStage } from '../../utils/inspectionCenterData';

export type CenterTab = 'overview' | 'dispatch' | 'staff' | 'orders' | 'checklists' | 'pricing' | 'appeals' | 'profile' | 'wallet';
export type DispatchFilter = 'ALL' | NonNullable<ReturnType<typeof getCenterDispatchStage>>;

export function getCenterTabDataNeeds(tab: string) {
  return {
    orders: ['overview', 'dispatch', 'staff', 'orders', 'appeals'].includes(tab),
    staff: ['overview', 'dispatch', 'staff', 'orders'].includes(tab),
  };
}

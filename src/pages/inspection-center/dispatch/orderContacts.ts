// Helper to reliably resolve seller address from multiple potential sources
export const getOrderSellerAddress = (ord: any): string => {
  if (!ord) return '123 Nguyễn Văn Cừ, Phường An Khánh, Quận Ninh Kiều, TP. Cần Thơ';
  if (ord.sellerAddress && ord.sellerAddress !== 'Địa chỉ nhà người bán' && ord.sellerAddress !== 'Địa chỉ kho người bán') return ord.sellerAddress;
  if (ord.address && ord.address !== 'Địa chỉ nhà người bán' && ord.address !== 'Địa chỉ kho người bán') return ord.address;
  if (ord.listing?.sellerAddress) return ord.listing.sellerAddress;
  if (ord.listing?.location && ord.listing.location !== 'Đà Nẵng, Việt Nam') return ord.listing.location;
  if (ord.shippingLegs?.[0]?.origin && ord.shippingLegs[0].origin !== 'Địa chỉ kho người bán') return ord.shippingLegs[0].origin;

  // Check localStorage recent_placed_orders
  try {
    const rawRecent = localStorage.getItem('recent_placed_orders');
    if (rawRecent) {
      const list = JSON.parse(rawRecent);
      const found = list.find((o: any) => o.id === ord.id || o.linkedOrderId === ord.id);
      if (found) {
        const addr = found.sellerAddress || found.listing?.sellerAddress || found.listing?.location || found.pickupAddress || found.shippingLegs?.[0]?.origin;
        if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
      }
    }
  } catch {}

  // Check localStorage center_inspection_orders
  try {
    const rawCenter = localStorage.getItem('center_inspection_orders');
    if (rawCenter) {
      const list = JSON.parse(rawCenter);
      const found = list.find((o: any) => o.id === ord.id);
      if (found) {
        const addr = found.sellerAddress || found.listing?.sellerAddress || found.listing?.location || found.shippingLegs?.[0]?.origin;
        if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
      }
    }
  } catch {}

  // Check marketplace_listings
  try {
    const rawList = localStorage.getItem('marketplace_listings');
    if (rawList) {
      const listings = JSON.parse(rawList);
      const pId = ord.postId || ord.listingId || ord.listing?.id;
      const foundListing = listings.find((l: any) => l.id === pId);
      if (foundListing) {
        const addr = foundListing.sellerAddress || foundListing.location || foundListing.pickupAddress;
        if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
      }
    }
  } catch {}

  if (ord.sellerAddress && ord.sellerAddress !== 'Địa chỉ nhà người bán' && ord.sellerAddress !== 'Địa chỉ kho người bán') {
    return ord.sellerAddress;
  }
  if (ord.listing?.sellerAddress) return ord.listing.sellerAddress;
  if (ord.listing?.location) return ord.listing.location;
  return '123 Nguyễn Văn Cừ, Phường An Khánh, Quận Ninh Kiều, TP. Cần Thơ';
};

export const getOrderSellerPhone = (ord: any): string => {
  if (!ord) return '0918 234 567';
  if (ord.sellerPhone) return ord.sellerPhone;
  if (ord.seller?.phone) return ord.seller.phone;
  try {
    const rawRecent = localStorage.getItem('recent_placed_orders');
    if (rawRecent) {
      const list = JSON.parse(rawRecent);
      const found = list.find((o: any) => o.id === ord.id);
      if (found?.sellerPhone || found?.seller?.phone) return found.sellerPhone || found.seller.phone;
    }
  } catch {}
  return '0918 234 567';
};

export const getOrderSellerName = (ord: any): string => {
  if (!ord) return 'Người bán';
  if (ord.sellerName && ord.sellerName !== 'Người bán') return ord.sellerName;
  if (ord.seller?.fullName) return ord.seller.fullName;
  try {
    const rawRecent = localStorage.getItem('recent_placed_orders');
    if (rawRecent) {
      const list = JSON.parse(rawRecent);
      const found = list.find((o: any) => o.id === ord.id);
      if (found?.sellerName || found?.seller?.fullName) return found.sellerName || found.seller.fullName;
    }
  } catch {}
  return ord.sellerName || 'Thị Thùy Trang Nguyễn';
};

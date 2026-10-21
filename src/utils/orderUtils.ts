export const getSortableOrderTimestamp = (ord: any): number => {
  if (!ord) return 0;
  const candidates = [
    ord.createdAt,
    ord.createdDate,
    ord.created_at,
    ord.timestamp,
    ord.paidAt,
    ord.sellerConfirmedAt,
    ord.sellerReadyAt,
    ord.carrierPickedUpAt,
    ord.shippingDeliveredAt,
    ord.appointmentScheduledAt,
    ord.updatedAt,
  ];

  for (const val of candidates) {
    if (val === undefined || val === null || val === '') continue;

    if (val instanceof Date) {
      const t = val.getTime();
      if (!isNaN(t) && t > 0) return t;
    }

    if (typeof val === 'number') {
      if (isNaN(val) || val <= 0) continue;
      if (val < 1e11) return Math.round(val * 1000);
      return Math.round(val);
    }

    if (Array.isArray(val) && val.length >= 3) {
      const y = val[0];
      const m = (val[1] || 1) - 1;
      const d = val[2] || 1;
      const h = val[3] || 0;
      const min = val[4] || 0;
      const s = val[5] || 0;
      const dt = new Date(y, m, d, h, min, s);
      const t = dt.getTime();
      if (!isNaN(t) && t > 0) return t;
    }

    if (typeof val === 'string') {
      const s = val.trim();
      if (!s) continue;

      if (/^\d+(\.\d+)?$/.test(s)) {
        const num = parseFloat(s);
        if (!isNaN(num) && num > 0) {
          if (num < 1e11) return Math.round(num * 1000);
          return Math.round(num);
        }
      }

      const parsedIso = Date.parse(s);
      if (!isNaN(parsedIso) && parsedIso > 0) {
        return parsedIso;
      }

      const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1;
        const year = parseInt(dmy[3], 10);
        const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
        const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
        const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
        const dt = new Date(year, month, day, hour, min, sec);
        const t = dt.getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
  }

  return 0;
};

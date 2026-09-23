import type { AdminNotification } from '@/types';
import { daysAgo, hoursAgo } from '@/lib/rng';

export const adminNotifications: AdminNotification[] = [
  { id: 'ntf-001', title: 'Weekend Free Delivery is live', body: 'FREEDEL promo pushed to all customers for the weekend.', audience: 'customers', sentAt: hoursAgo(6), reach: 48210 },
  { id: 'ntf-002', title: 'New commission slab effective 1 Oct', body: 'Updated commission rates have been communicated to all active vendors.', audience: 'vendors', sentAt: daysAgo(1), reach: 312 },
  { id: 'ntf-003', title: 'Surge zone bonus — Sector 62', body: 'Extra ₹20/delivery bonus active for the next 3 hours in Sector 62, Noida.', audience: 'drivers', sentAt: hoursAgo(2), reach: 46 },
  { id: 'ntf-004', title: 'Scheduled maintenance tonight', body: 'Platform will be briefly unavailable between 2–2:30 AM IST for maintenance.', audience: 'all', sentAt: daysAgo(2), reach: 52890 },
  { id: 'ntf-005', title: 'GST invoice update rolled out', body: 'Vendors can now download consolidated monthly GST invoices from Payments.', audience: 'vendors', sentAt: daysAgo(4), reach: 312 },
];

import type { Offer } from '@/types';
import { daysAgo } from '@/lib/rng';

export const offers: Offer[] = [
  { id: 'off-001', title: 'Welcome Offer', description: 'Flat 25% off on your first order', code: 'WELCOME25', type: 'percentage', value: 25, minOrderValue: 199, appliesTo: 'New customers · all categories', usageCount: 3120, status: 'active', startDate: daysAgo(60), endDate: daysAgo(-30) },
  { id: 'off-002', title: 'Free Delivery Weekend', description: 'No delivery fee on orders above ₹149', code: 'FREEDEL', type: 'free-delivery', value: 0, minOrderValue: 149, appliesTo: 'All customers · all categories', usageCount: 5840, status: 'active', startDate: daysAgo(10), endDate: daysAgo(-4) },
  { id: 'off-003', title: 'Grocery Bonanza', description: 'Flat ₹75 off on Grocery & Staples', code: 'GROCERY75', type: 'flat', value: 75, minOrderValue: 499, appliesTo: 'Grocery & Staples', usageCount: 1284, status: 'active', startDate: daysAgo(5), endDate: daysAgo(-9) },
  { id: 'off-004', title: 'Festive Snacks Sale', description: '15% off Snacks & Beverages', code: 'SNACK15', type: 'percentage', value: 15, minOrderValue: 249, appliesTo: 'Snacks & Beverages', usageCount: 0, status: 'active', startDate: daysAgo(-3), endDate: daysAgo(-20) },
  { id: 'off-005', title: 'Dairy Delight', description: 'Flat ₹30 off on Dairy & Eggs', code: 'DAIRY30', type: 'flat', value: 30, minOrderValue: 150, appliesTo: 'Dairy & Eggs', usageCount: 940, status: 'paused', startDate: daysAgo(20), endDate: daysAgo(-5) },
  { id: 'off-006', title: 'Monsoon Mega Sale', description: '20% off storewide', code: 'MONSOON20', type: 'percentage', value: 20, minOrderValue: 399, appliesTo: 'All categories', usageCount: 7650, status: 'expired', startDate: daysAgo(90), endDate: daysAgo(60) },
  { id: 'off-007', title: 'Personal Care Special', description: 'Flat 10% off Personal Care', code: 'CARE10', type: 'percentage', value: 10, minOrderValue: 299, appliesTo: 'Personal Care', usageCount: 512, status: 'active', startDate: daysAgo(8), endDate: daysAgo(-15) },
];

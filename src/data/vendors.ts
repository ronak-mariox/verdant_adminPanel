import type { Vendor } from '@/types';
import { createRng, pick, pickWeighted, intBetween, daysAgo } from '@/lib/rng';

const rng = createRng(42);

const storeNames = [
  'Fresh Basket', 'GreenLeaf Mart', 'DailyNeeds Store', 'QuickGrocer', 'Urban Pantry',
  'Sunrise Provisions', 'City Fresh Mart', 'Value Grocers', 'Neighbourhood Kirana', 'MetroMart',
  'Farm2Home', 'Local Basket', 'Prime Grocery', 'Everyday Essentials', 'Spice & Grain Co.',
  'BlueSky Store', 'Green Valley Mart', 'Happy Homes Grocery',
];
const owners = [
  'Rahul Sharma', 'Priya Nair', 'Amit Verma', 'Sneha Kapoor', 'Vikram Singh', 'Anjali Mehta',
  'Rohan Gupta', 'Kavita Iyer', 'Sameer Khan', 'Divya Reddy', 'Arjun Patel', 'Neha Joshi',
  'Karan Malhotra', 'Pooja Desai', 'Manoj Kumar', 'Ritu Agarwal', 'Suresh Rao', 'Ananya Bose',
];
const cities = ['Noida', 'Gurugram', 'Delhi', 'Bengaluru', 'Pune', 'Mumbai', 'Hyderabad', 'Chennai'];
const catTags = ['Grocery & Staples', 'Fruits & Vegetables', 'Dairy & Bakery', 'General Store', 'Organic Foods'];
const avatarColors = ['#1CA672', '#3B82F6', '#F79009', '#7C3AED', '#0891B2', '#DC2626', '#4338CA'];

export const vendors: Vendor[] = storeNames.map((storeName, i) => {
  const status = pickWeighted(rng, [
    ['active', 70],
    ['pending', 15],
    ['suspended', 8],
    ['rejected', 7],
  ] as const);
  const kycStatus = status === 'active' ? 'verified' : pickWeighted(rng, [['pending', 60], ['rejected', 20], ['verified', 20]] as const);
  return {
    id: `vnd-${String(i + 1).padStart(3, '0')}`,
    storeName,
    ownerName: owners[i],
    email: `${owners[i].toLowerCase().replace(' ', '.')}@${storeName.toLowerCase().replace(/[^a-z]/g, '')}.in`,
    phone: `+91 9${intBetween(rng, 100000000, 999999999)}`,
    avatarColor: pick(rng, avatarColors),
    category: pick(rng, catTags),
    city: pick(rng, cities),
    address: `${intBetween(rng, 1, 200)}, ${pick(rng, ['Sector 18', 'MG Road', 'Park Street', 'Ring Road', 'Model Town'])}, ${cities[i % cities.length]}`,
    status,
    kycStatus,
    rating: Number((3.4 + rng() * 1.6).toFixed(1)),
    totalOrders: intBetween(rng, 40, 4200),
    revenue: intBetween(rng, 25000, 1850000),
    commissionRate: pick(rng, [8, 10, 12, 15]),
    productsCount: intBetween(rng, 15, 320),
    joinedAt: daysAgo(intBetween(rng, 10, 640)),
    gstNumber: `${intBetween(rng, 10, 37)}ABCDE${intBetween(rng, 1000, 9999)}F1Z${intBetween(rng, 1, 9)}`,
  };
});

export const vendorById = (id: string) => vendors.find((v) => v.id === id);

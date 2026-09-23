import type { Driver } from '@/types';
import { createRng, pick, pickWeighted, intBetween, daysAgo } from '@/lib/rng';

const rng = createRng(7);

const names = [
  'Rahul Sharma', 'Deepak Yadav', 'Mohammed Irfan', 'Suresh Pillai', 'Ajay Kumar', 'Ramesh Chandra',
  'Vijay Singh', 'Naveen Reddy', 'Sandeep Malik', 'Ravi Teja', 'Gopal Krishnan', 'Harish Chauhan',
  'Imran Ali', 'Manoj Tiwari', 'Sunil Dutta', 'Praveen Nair', 'Yash Thakur', 'Bhupendra Rathi',
  'Karthik Subramaniam', 'Faisal Ahmed', 'Rakesh Bhatt', 'Sanjay Verma',
];
const zones = ['Sector 62, Noida', 'Cyber City, Gurugram', 'Koramangala, Bengaluru', 'Andheri West, Mumbai', 'Hitech City, Hyderabad', 'Baner, Pune'];
const avatarColors = ['#1CA672', '#3B82F6', '#F79009', '#7C3AED', '#0891B2', '#DC2626'];

export const drivers: Driver[] = names.map((name, i) => {
  const status = pickWeighted(rng, [
    ['active', 55],
    ['pending', 15],
    ['suspended', 20],
    ['rejected', 10],
  ] as const);
  const kycStatus = status === 'suspended' ? pick(rng, ['pending', 'rejected'] as const) : pickWeighted(rng, [['verified', 85], ['pending', 15]] as const);
  return {
    id: `drv-${String(i + 1).padStart(3, '0')}`,
    name,
    phone: `+91 8${intBetween(rng, 100000000, 999999999)}`,
    email: `${name.toLowerCase().replace(' ', '.')}@drivermail.in`,
    avatarColor: pick(rng, avatarColors),
    vehicleType: pickWeighted(rng, [['motorbike', 55], ['scooter', 30], ['bicycle', 10], ['other', 5]] as const),
    vehicleNumber: `${pick(rng, ['DL', 'UP', 'KA', 'MH', 'TS'])}${intBetween(rng, 1, 14)} ${pick(rng, ['AB', 'BC', 'CD', 'DE'])} ${intBetween(rng, 1000, 9999)}`,
    zone: pick(rng, zones),
    status,
    kycStatus,
    rating: Number((3.6 + rng() * 1.4).toFixed(1)),
    totalDeliveries: intBetween(rng, 30, 5200),
    completionRate: intBetween(rng, 82, 99),
    earningsThisMonth: intBetween(rng, 4000, 42000),
    joinedAt: daysAgo(intBetween(rng, 5, 520)),
  };
});

export const driverById = (id: string) => drivers.find((d) => d.id === id);

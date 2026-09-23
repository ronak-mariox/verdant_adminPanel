import type { Customer } from '@/types';
import { createRng, pick, pickWeighted, intBetween, daysAgo } from '@/lib/rng';

const rng = createRng(99);

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Sai', 'Ananya', 'Diya', 'Myra', 'Saanvi', 'Kiara', 'Rohan', 'Kabir', 'Arjun', 'Neha', 'Priya', 'Riya', 'Sanya', 'Tara', 'Varun', 'Zoya', 'Aryan', 'Meera', 'Nikhil', 'Pooja'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Patel', 'Reddy', 'Singh', 'Kapoor', 'Malhotra', 'Joshi', 'Rao', 'Bose', 'Desai', 'Khan', 'Mehta'];
const cities = ['Noida', 'Gurugram', 'Delhi', 'Bengaluru', 'Pune', 'Mumbai', 'Hyderabad', 'Chennai'];
const avatarColors = ['#1CA672', '#3B82F6', '#F79009', '#7C3AED', '#0891B2', '#DC2626', '#4338CA', '#EA580C'];

export const customers: Customer[] = Array.from({ length: 34 }, (_, i) => {
  const first = pick(rng, firstNames);
  const last = pick(rng, lastNames);
  const totalOrders = intBetween(rng, 0, 180);
  const joined = intBetween(rng, 5, 700);
  return {
    id: `cus-${String(i + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${intBetween(rng, 1, 99)}@gmail.com`,
    phone: `+91 7${intBetween(rng, 100000000, 999999999)}`,
    avatarColor: pick(rng, avatarColors),
    city: pick(rng, cities),
    status: pickWeighted(rng, [['active', 92], ['blocked', 8]] as const),
    totalOrders,
    totalSpent: totalOrders * intBetween(rng, 180, 650),
    joinedAt: daysAgo(joined),
    lastOrderAt: totalOrders > 0 ? daysAgo(intBetween(rng, 0, Math.min(joined, 60))) : daysAgo(joined),
  };
});

export const customerById = (id: string) => customers.find((c) => c.id === id);

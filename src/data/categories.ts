import type { Category } from '@/types';

const img = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`;

// Mirrors the taxonomy defined in vender_app/src/data/categories.ts so a category
// created/edited here maps 1:1 to what the Verdant customer app renders.
export const categories: Category[] = [
  {
    id: 'cat-grocery',
    name: 'Grocery & Staples',
    image: img('grocery-staples'),
    colorFrom: '#4ADE80',
    colorTo: '#16A34A',
    order: 1,
    status: 'active',
    showOnHome: true,
    subcategories: [
      { id: 'sub-atta-rice', categoryId: 'cat-grocery', name: 'Atta, Rice & Dal', image: img('atta-rice'), productCount: 84, status: 'active' },
      { id: 'sub-oil-ghee', categoryId: 'cat-grocery', name: 'Edible Oil & Ghee', image: img('oil-ghee'), productCount: 41, status: 'active' },
      { id: 'sub-masala', categoryId: 'cat-grocery', name: 'Masala & Spices', image: img('masala'), productCount: 63, status: 'active' },
      { id: 'sub-sugar-salt', categoryId: 'cat-grocery', name: 'Sugar & Salt', image: img('sugar-salt'), productCount: 22, status: 'active' },
    ],
  },
  {
    id: 'cat-dairy',
    name: 'Dairy & Eggs',
    image: img('dairy-eggs'),
    colorFrom: '#93C5FD',
    colorTo: '#2563EB',
    order: 2,
    status: 'active',
    showOnHome: true,
    subcategories: [
      { id: 'sub-milk', categoryId: 'cat-dairy', name: 'Milk', image: img('milk'), productCount: 18, status: 'active' },
      { id: 'sub-curd-yogurt', categoryId: 'cat-dairy', name: 'Curd & Yogurt', image: img('curd'), productCount: 26, status: 'active' },
      { id: 'sub-paneer-cheese', categoryId: 'cat-dairy', name: 'Paneer & Cheese', image: img('paneer'), productCount: 33, status: 'active' },
      { id: 'sub-eggs', categoryId: 'cat-dairy', name: 'Eggs', image: img('eggs'), productCount: 9, status: 'active' },
    ],
  },
  {
    id: 'cat-fruits-veg',
    name: 'Fruits & Vegetables',
    image: img('fruits-veg'),
    colorFrom: '#BBF7D0',
    colorTo: '#15803D',
    order: 3,
    status: 'active',
    showOnHome: true,
    subcategories: [
      { id: 'sub-fresh-veg', categoryId: 'cat-fruits-veg', name: 'Fresh Vegetables', image: img('fresh-veg'), productCount: 57, status: 'active' },
      { id: 'sub-fresh-fruits', categoryId: 'cat-fruits-veg', name: 'Fresh Fruits', image: img('fresh-fruits'), productCount: 48, status: 'active' },
      { id: 'sub-herbs', categoryId: 'cat-fruits-veg', name: 'Herbs & Seasoning', image: img('herbs'), productCount: 14, status: 'active' },
    ],
  },
  {
    id: 'cat-snacks',
    name: 'Snacks & Beverages',
    image: img('snacks-bev'),
    colorFrom: '#FDE68A',
    colorTo: '#D97706',
    order: 4,
    status: 'active',
    showOnHome: true,
    subcategories: [
      { id: 'sub-chips-namkeen', categoryId: 'cat-snacks', name: 'Chips & Namkeen', image: img('chips'), productCount: 71, status: 'active' },
      { id: 'sub-biscuits', categoryId: 'cat-snacks', name: 'Biscuits & Cookies', image: img('biscuits'), productCount: 52, status: 'active' },
      { id: 'sub-soft-drinks', categoryId: 'cat-snacks', name: 'Soft Drinks & Juices', image: img('drinks'), productCount: 38, status: 'active' },
      { id: 'sub-tea-coffee', categoryId: 'cat-snacks', name: 'Tea & Coffee', image: img('tea-coffee'), productCount: 29, status: 'active' },
    ],
  },
  {
    id: 'cat-personal-care',
    name: 'Personal Care',
    image: img('personal-care'),
    colorFrom: '#FBCFE8',
    colorTo: '#BE185D',
    order: 5,
    status: 'active',
    showOnHome: true,
    subcategories: [
      { id: 'sub-bath-body', categoryId: 'cat-personal-care', name: 'Bath & Body', image: img('bath-body'), productCount: 44, status: 'active' },
      { id: 'sub-hair-care', categoryId: 'cat-personal-care', name: 'Hair Care', image: img('hair-care'), productCount: 31, status: 'active' },
      { id: 'sub-oral-care', categoryId: 'cat-personal-care', name: 'Oral Care', image: img('oral-care'), productCount: 19, status: 'active' },
      { id: 'sub-skin-care', categoryId: 'cat-personal-care', name: 'Skin Care', image: img('skin-care'), productCount: 27, status: 'active' },
    ],
  },
  {
    id: 'cat-household',
    name: 'Household & Cleaning',
    image: img('household'),
    colorFrom: '#A5F3FC',
    colorTo: '#0E7490',
    order: 6,
    status: 'active',
    showOnHome: false,
    subcategories: [
      { id: 'sub-cleaners', categoryId: 'cat-household', name: 'Cleaners & Detergents', image: img('cleaners'), productCount: 36, status: 'active' },
      { id: 'sub-kitchen-tools', categoryId: 'cat-household', name: 'Kitchen & Dining', image: img('kitchen'), productCount: 22, status: 'active' },
      { id: 'sub-paper-disposable', categoryId: 'cat-household', name: 'Paper & Disposables', image: img('paper'), productCount: 15, status: 'active' },
    ],
  },
  {
    id: 'cat-baby-kids',
    name: 'Baby & Kids',
    image: img('baby-kids'),
    colorFrom: '#DDD6FE',
    colorTo: '#6D28D9',
    order: 7,
    status: 'active',
    showOnHome: false,
    subcategories: [
      { id: 'sub-diapers', categoryId: 'cat-baby-kids', name: 'Diapers & Wipes', image: img('diapers'), productCount: 21, status: 'active' },
      { id: 'sub-baby-food', categoryId: 'cat-baby-kids', name: 'Baby Food', image: img('baby-food'), productCount: 17, status: 'active' },
    ],
  },
  {
    id: 'cat-health',
    name: 'Health & Wellness',
    image: img('health-wellness'),
    colorFrom: '#FCA5A5',
    colorTo: '#B91C1C',
    order: 8,
    status: 'inactive',
    showOnHome: false,
    subcategories: [
      { id: 'sub-supplements', categoryId: 'cat-health', name: 'Supplements', image: img('supplements'), productCount: 12, status: 'active' },
      { id: 'sub-otc', categoryId: 'cat-health', name: 'OTC & First Aid', image: img('otc'), productCount: 8, status: 'inactive' },
    ],
  },
];

export const allSubcategories = categories.flatMap((c) => c.subcategories);

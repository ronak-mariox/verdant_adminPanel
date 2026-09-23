import type { Product, ProductStatus } from '@/types';
import { categories, allSubcategories } from './categories';
import { vendors } from './vendors';
import { createRng, pick, pickWeighted, intBetween, daysAgo } from '@/lib/rng';

const rng = createRng(123);

const brands = ['Fortune', 'Aashirvaad', 'Tata Sampann', 'Amul', 'Nestle', 'Britannia', 'ITC', 'Patanjali', 'Mother Dairy', 'Haldiram\'s', 'Dabur', 'Colgate', 'Himalaya', 'Parle', "Lay's"];
const productNouns = [
  'Refined Sunflower Oil', 'Whole Wheat Atta', 'Basmati Rice', 'Toor Dal', 'Turmeric Powder',
  'Garam Masala', 'Iodised Salt', 'Full Cream Milk', 'Fresh Curd', 'Paneer Block', 'Farm Eggs (6 pc)',
  'Tomatoes', 'Onions', 'Potatoes', 'Bananas', 'Apples', 'Coriander Leaves', 'Potato Chips',
  'Digestive Biscuits', 'Cola Soft Drink', 'Orange Juice', 'Masala Tea', 'Instant Coffee',
  'Body Wash', 'Shampoo', 'Toothpaste', 'Face Wash', 'Dishwash Liquid', 'Detergent Powder',
  'Kitchen Tissue Roll', 'Baby Diapers', 'Baby Food Cereal', 'Multivitamin Tablets',
];
const units = ['500 g', '1 kg', '1 L', '500 ml', '200 g', '250 g', '6 pcs', '2 kg', '100 g', '750 ml'];

const statusPool: [ProductStatus, number][] = [
  ['active', 58],
  ['low-stock', 14],
  ['out-of-stock', 8],
  ['pending', 12],
  ['rejected', 4],
  ['draft', 4],
];

const img = (seed: string) => `https://picsum.photos/seed/${seed}/240/240`;

export const products: Product[] = Array.from({ length: 96 }, (_, i) => {
  const category = pick(rng, categories);
  const subcats = allSubcategories.filter((s) => s.categoryId === category.id);
  const subcategory = subcats.length ? pick(rng, subcats) : allSubcategories[0];
  const vendor = pick(rng, vendors);
  const brand = pick(rng, brands);
  const noun = pick(rng, productNouns);
  const mrp = intBetween(rng, 25, 1200);
  const discountPct = pickWeighted(rng, [[0, 30], [5, 20], [10, 25], [15, 15], [20, 10]] as const);
  const sellingPrice = Math.round(mrp * (1 - discountPct / 100));
  const status = pickWeighted(rng, statusPool);
  const stock = status === 'out-of-stock' ? 0 : status === 'low-stock' ? intBetween(rng, 1, 8) : intBetween(rng, 15, 500);

  return {
    id: `prd-${String(i + 1).padStart(4, '0')}`,
    name: `${brand} ${noun}`,
    brand,
    image: img(`product-${i}`),
    categoryId: category.id,
    categoryName: category.name,
    subcategoryId: subcategory.id,
    subcategoryName: subcategory.name,
    vendorId: vendor.id,
    vendorName: vendor.storeName,
    mrp,
    sellingPrice,
    unit: pick(rng, units),
    stock,
    reorderLevel: 10,
    sku: `SKU-${intBetween(rng, 100000, 999999)}`,
    gstRate: pick(rng, [0, 5, 12, 18]),
    status,
    rating: Number((3.2 + rng() * 1.8).toFixed(1)),
    ratingCount: intBetween(rng, 0, 2400),
    updatedAt: daysAgo(intBetween(rng, 0, 90)),
  };
});

export const productById = (id: string) => products.find((p) => p.id === id);

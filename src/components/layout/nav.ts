import {
  LayoutDashboard,
  ListTree,
  Package,
  ShoppingBag,
  Store,
  Bike,
  Users,
  Tag,
  Wallet,
  Landmark,
  BarChart3,
  LifeBuoy,
  Settings,
  Gift,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Categories', to: '/categories', icon: ListTree },
      { label: 'Products', to: '/products', icon: Package },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders', to: '/orders', icon: ShoppingBag },
      { label: 'Vendors', to: '/vendors', icon: Store },
      { label: 'Delivery Partners', to: '/drivers', icon: Bike },
      { label: 'Driver Incentives', to: '/incentives', icon: Gift },
      { label: 'Customers', to: '/customers', icon: Users },
    ],
  },
  {
    label: 'Growth',
    items: [{ label: 'Offers & Promotions', to: '/offers', icon: Tag }],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Settlements & Payouts', to: '/settlements', icon: Wallet },
      { label: 'Bank Details Requests', to: '/bank-details-requests', icon: Landmark },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Analytics', to: '/analytics', icon: BarChart3 }],
  },
  {
    label: 'Engagement',
    items: [{ label: 'Support Tickets', to: '/support', icon: LifeBuoy }],
  },
  {
    label: 'System',
    items: [{ label: 'Platform Config', to: '/settings', icon: Settings }],
  },
];

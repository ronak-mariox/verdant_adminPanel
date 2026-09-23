import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  FileText,
  IndianRupee,
  ShoppingBag,
  Package,
  Percent,
  CheckCircle2,
  XCircle,
  Ban,
  Store,
  Loader2,
  AlertTriangle,
  ImageOff,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { KycStatus, Order, ProductStatus, Vendor, VendorSettlementRecord, VendorStatus } from '@/types';
import { ORDER_STATUS_META } from '@/types';
import { formatCurrency, formatDate, timeAgo } from '@/lib/format';
import { api, fetchAllPaginated } from '@/lib/api';
import {
  mapOrder,
  vendorDisplayName,
  vendorCity,
  errorMessage,
  type ApiCustomer,
  type ApiDriver,
  type ApiOrder,
  type ApiVendor as ApiVendorBase,
} from '@/lib/adminOrders';
import { avatarColorFor } from '@/lib/avatarColor';
import { resolveAssetUrl } from '@/lib/asset';
import { cn } from '@/lib/cn';

const ROW_CAP = 15;

// ---------------------------------------------------------------------------
// Backend shapes
// ---------------------------------------------------------------------------

type StepReviewStatus = 'pending' | 'verified' | 'rejected';

interface ApiStepReview {
  status: StepReviewStatus;
  note?: string;
  reviewedAt?: string;
}

type RegistrationStepKey =
  | 'businessType'
  | 'businessInfo'
  | 'ownerInfo'
  | 'storeInfo'
  | 'gstDetails'
  | 'panDetails'
  | 'businessProof'
  | 'bankDetails';

interface ApiVendor extends Omit<ApiVendorBase, 'businessInfo'> {
  email?: string;
  status: VendorStatus;
  kycStatus: KycStatus;
  businessType?: string;
  businessInfo?: {
    legalName?: string;
    displayName?: string;
    category?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    pincode?: string;
  };
  ownerInfo?: { fullName?: string; mobile?: string; email?: string; dob?: string; pan?: string };
  storeInfo?: { storeName?: string; storeAddress?: string; contactNumber?: string; storeType?: string };
  gstDetails?: { registered?: boolean; gstin?: string; businessName?: string; certificateUrl?: string };
  panDetails?: { panNumber?: string; holderName?: string; documentUrl?: string };
  businessProof?: { documentType?: string; documentNumber?: string; expiryDate?: string; frontUrl?: string; backUrl?: string };
  bankDetails?: { accountHolderName?: string; accountNumber?: string; ifsc?: string; bankName?: string; branch?: string };
  stepReviews?: Partial<Record<RegistrationStepKey, ApiStepReview>>;
  createdAt: string;
}

interface StepRow {
  label: string;
  value: string;
  /** Backend-relative document URL, when this row represents an uploaded file. */
  previewUrl?: string;
}

/** Very small check to decide preview rendering — uploads store no content-type, only a URL. */
function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

const STEP_DEFS: { key: RegistrationStepKey; title: string; rows: (v: ApiVendor) => StepRow[] | null }[] = [
  {
    key: 'businessType',
    title: 'Business Type',
    rows: (v) => (v.businessType ? [{ label: 'Type', value: v.businessType }] : null),
  },
  {
    key: 'businessInfo',
    title: 'Business Information',
    rows: (v) =>
      v.businessInfo
        ? [
            { label: 'Legal Name', value: v.businessInfo.legalName ?? '—' },
            { label: 'Display Name', value: v.businessInfo.displayName ?? '—' },
            { label: 'Category', value: v.businessInfo.category ?? '—' },
            {
              label: 'Address',
              value: [v.businessInfo.addressLine1, v.businessInfo.city, v.businessInfo.pincode].filter(Boolean).join(', ') || '—',
            },
          ]
        : null,
  },
  {
    key: 'ownerInfo',
    title: 'Owner Information',
    rows: (v) =>
      v.ownerInfo
        ? [
            { label: 'Full Name', value: v.ownerInfo.fullName ?? '—' },
            { label: 'Mobile', value: v.ownerInfo.mobile ?? '—' },
            { label: 'Email', value: v.ownerInfo.email ?? '—' },
            { label: 'PAN', value: v.ownerInfo.pan ?? '—' },
          ]
        : null,
  },
  {
    key: 'storeInfo',
    title: 'Store Information',
    rows: (v) =>
      v.storeInfo
        ? [
            { label: 'Store Name', value: v.storeInfo.storeName ?? '—' },
            { label: 'Store Address', value: v.storeInfo.storeAddress ?? '—' },
            { label: 'Contact', value: v.storeInfo.contactNumber ?? '—' },
            { label: 'Type', value: v.storeInfo.storeType ?? '—' },
          ]
        : null,
  },
  {
    key: 'gstDetails',
    title: 'GST Details',
    rows: (v) =>
      v.gstDetails?.registered
        ? [
            { label: 'GSTIN', value: v.gstDetails.gstin ?? '—' },
            { label: 'Business Name', value: v.gstDetails.businessName ?? '—' },
            {
              label: 'Certificate',
              value: v.gstDetails.certificateUrl ? 'Uploaded' : 'Not uploaded',
              previewUrl: v.gstDetails.certificateUrl,
            },
          ]
        : null,
  },
  {
    key: 'panDetails',
    title: 'PAN Verification',
    rows: (v) =>
      v.panDetails
        ? [
            { label: 'PAN Number', value: v.panDetails.panNumber ?? '—' },
            { label: 'PAN Holder', value: v.panDetails.holderName ?? '—' },
            {
              label: 'Document',
              value: v.panDetails.documentUrl ? 'Uploaded' : 'Not uploaded',
              previewUrl: v.panDetails.documentUrl,
            },
          ]
        : null,
  },
  {
    key: 'businessProof',
    title: 'Business Proof',
    rows: (v) => {
      if (!v.businessProof) return null;
      const rows: StepRow[] = [
        { label: 'Document Type', value: v.businessProof.documentType ?? '—' },
        { label: 'Number', value: v.businessProof.documentNumber ?? '—' },
        { label: 'Valid Until', value: v.businessProof.expiryDate ?? '—' },
        {
          label: 'Front',
          value: v.businessProof.frontUrl ? 'Uploaded' : 'Not uploaded',
          previewUrl: v.businessProof.frontUrl,
        },
      ];
      if (v.businessProof.backUrl) {
        rows.push({ label: 'Back', value: 'Uploaded', previewUrl: v.businessProof.backUrl });
      }
      return rows;
    },
  },
  {
    key: 'bankDetails',
    title: 'Bank Details',
    rows: (v) =>
      v.bankDetails
        ? [
            { label: 'Account Holder', value: v.bankDetails.accountHolderName ?? '—' },
            { label: 'Account Number', value: v.bankDetails.accountNumber ? `•••• ${v.bankDetails.accountNumber.slice(-4)}` : '—' },
            { label: 'IFSC', value: v.bankDetails.ifsc ?? '—' },
            { label: 'Bank', value: [v.bankDetails.bankName, v.bankDetails.branch].filter(Boolean).join(' – ') || '—' },
          ]
        : null,
  },
];

interface ApiProductVariant {
  mrp?: number;
  price?: number;
  stock?: number;
  isPrimary?: boolean;
}

interface ApiProduct {
  id: string;
  name: string;
  images: string[];
  categoryId: string;
  unit?: string;
  variants: ApiProductVariant[];
  reorderLevel?: number;
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'rejected';
}

interface ApiCategory {
  id: string;
  name: string;
}

interface VendorProductRow {
  id: string;
  name: string;
  image: string;
  categoryName: string;
  sellingPrice: number;
  stock: number;
  status: ProductStatus;
}

function deriveProductStatus(p: ApiProduct, stock: number): ProductStatus {
  if (p.status === 'active') {
    if (stock <= 0) return 'out-of-stock';
    if (p.reorderLevel != null && stock <= p.reorderLevel) return 'low-stock';
    return 'active';
  }
  if (p.status === 'pending') return 'pending';
  if (p.status === 'rejected') return 'rejected';
  if (p.status === 'inactive') return 'inactive';
  return 'draft';
}

function mapVendorProduct(p: ApiProduct, categoryNameById: Map<string, string>): VendorProductRow {
  const variant = p.variants.find((v) => v.isPrimary) ?? p.variants[0];
  const stock = variant?.stock ?? 0;
  return {
    id: p.id,
    name: p.name,
    image: p.images[0] ? resolveAssetUrl(p.images[0]) : '',
    categoryName: categoryNameById.get(p.categoryId) ?? 'Uncategorised',
    sellingPrice: variant?.price ?? 0,
    stock,
    status: deriveProductStatus(p, stock),
  };
}

function mapVendor(v: ApiVendor, stats: { productsCount: number; totalOrders: number; revenue: number }): Vendor {
  const addressLines = [v.businessInfo?.addressLine1, v.businessInfo?.addressLine2].filter(Boolean).join(', ');
  return {
    id: v.id,
    storeName: vendorDisplayName(v),
    ownerName: v.fullName ?? '—',
    email: v.email ?? '—',
    phone: v.phone,
    avatarColor: avatarColorFor(v.id),
    category: v.businessInfo?.category ?? '—',
    city: vendorCity(v),
    address: addressLines || v.storeInfo?.storeAddress || '—',
    status: v.status,
    kycStatus: v.kycStatus,
    // No rating/commission data server-side at all — always 0, never fabricated.
    rating: 0,
    commissionRate: 0,
    totalOrders: stats.totalOrders,
    revenue: stats.revenue,
    productsCount: stats.productsCount,
    joinedAt: v.createdAt,
    gstNumber: v.gstDetails?.gstin ?? '—',
  };
}

const TERMINAL_NON_REVENUE_STATUSES = new Set(['cancelled', 'rejected']);

export function VendorDetail() {
  const { vendorId } = useParams<{ vendorId: string }>();

  const [vendorApi, setVendorApi] = useState<ApiVendor | null>(null);
  const [vendorProducts, setVendorProducts] = useState<VendorProductRow[]>([]);
  const [vendorOrders, setVendorOrders] = useState<Order[]>([]);
  const [vendorSettlementsData, setVendorSettlementsData] = useState<VendorSettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setVendorApiStats] = useState({ productsCount: 0, totalOrders: 0, revenue: 0 });

  const [activeTab, setActiveTab] = useState('products');
  const [suspendOpen, setSuspendOpen] = useState(false);

  const [stepUpdating, setStepUpdating] = useState<RegistrationStepKey | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [rejectStepKey, setRejectStepKey] = useState<RegistrationStepKey | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const v = await api.get<ApiVendor>(`/admin/vendors/${vendorId}`);
        const [productsRaw, ordersRaw, categoriesRaw, settlementsRaw] = await Promise.all([
          fetchAllPaginated<ApiProduct>('/admin/products', { vendorId }),
          fetchAllPaginated<ApiOrder>('/admin/orders', { vendorId }),
          api.get<ApiCategory[]>('/admin/categories'),
          api.get<VendorSettlementRecord[]>(`/admin/vendors/${vendorId}/settlements`),
        ]);

        const customerIds = Array.from(new Set(ordersRaw.map((o) => o.customerId)));
        const driverIds = Array.from(new Set(ordersRaw.map((o) => o.driverId).filter(Boolean))) as string[];
        const [customers, drivers] = await Promise.all([
          customerIds.length ? api.get<ApiCustomer[]>('/admin/customers') : Promise.resolve([] as ApiCustomer[]),
          driverIds.length ? api.get<ApiDriver[]>('/admin/drivers') : Promise.resolve([] as ApiDriver[]),
        ]);
        if (cancelled) return;

        const categoryNameById = new Map(categoriesRaw.map((c) => [c.id, c.name]));
        const customerById = new Map(customers.map((c) => [c.id, c]));
        const vendorById = new Map([[v.id, v]]);
        const driverById = new Map(drivers.map((d) => [d.id, d]));

        const revenue = ordersRaw
          .filter((o) => !TERMINAL_NON_REVENUE_STATUSES.has(o.status))
          .reduce((sum, o) => sum + o.pricing.grandTotal, 0);

        setVendorApi(v);
        setVendorProducts(productsRaw.map((p) => mapVendorProduct(p, categoryNameById)));
        setVendorOrders(ordersRaw.map((o) => mapOrder(o, customerById, vendorById, driverById)));
        setVendorApiStats({ productsCount: productsRaw.length, totalOrders: ordersRaw.length, revenue });
        setVendorSettlementsData(settlementsRaw);
      } catch (err) {
        if (cancelled) return;
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
          setNotFound(true);
        } else {
          setLoadError(errorMessage(err, 'Failed to load vendor'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, reloadKey]);

  const vendor = vendorApi ? mapVendor(vendorApi, stats) : null;

  async function updateStatus(status: VendorStatus) {
    if (!vendorId) return;
    setActionError(null);
    setUpdating(true);
    try {
      const updated = await api.patch<ApiVendor>(`/admin/vendors/${vendorId}/status`, { status });
      setVendorApi(updated);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update vendor status'));
    } finally {
      setUpdating(false);
    }
  }

  function approve() {
    updateStatus('active');
  }

  function reject() {
    updateStatus('rejected');
  }

  function confirmSuspend() {
    updateStatus('suspended');
    setSuspendOpen(false);
  }

  async function reviewStep(stepKey: RegistrationStepKey, status: StepReviewStatus, note?: string) {
    if (!vendorId) return;
    setStepError(null);
    setStepUpdating(stepKey);
    try {
      const updated = await api.patch<ApiVendor>(`/admin/vendors/${vendorId}/steps/${stepKey}`, { status, note });
      setVendorApi(updated);
      setRejectStepKey(null);
      setRejectNote('');
    } catch (err) {
      setStepError(errorMessage(err, 'Failed to update step review'));
    } finally {
      setStepUpdating(null);
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
          <ArrowLeft size={16} />
          Back to vendors
        </Link>
        <Card>
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading vendor…" />
        </Card>
      </div>
    );
  }

  if (notFound || !vendor) {
    return (
      <div>
        <Link to="/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
          <ArrowLeft size={16} />
          Back to vendors
        </Link>
        <Card>
          {loadError ? (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Couldn't load vendor"
              description={loadError}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
            />
          ) : (
            <EmptyState
              icon={<Store size={24} />}
              title="Vendor not found"
              description="This vendor may have been removed or the link is incorrect."
              action={
                <Link to="/vendors">
                  <Button variant="outline">Back to vendors</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  const tabItems: TabItem[] = [
    { value: 'products', label: 'Products', count: vendorProducts.length },
    { value: 'orders', label: 'Orders', count: vendorOrders.length },
    { value: 'settlements', label: 'Settlements', count: vendorSettlementsData.length },
  ];

  return (
    <div>
      <Link to="/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
        <ArrowLeft size={16} />
        Back to vendors
      </Link>

      <PageHeader title={vendor.storeName} subtitle={`Vendor ID: ${vendor.id}`} />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <Card className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={vendor.storeName} color={vendor.avatarColor} size={64} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-ink-900">{vendor.storeName}</h2>
                <StatusBadge status={vendor.status} />
                <StatusBadge status={vendor.kycStatus} />
              </div>
              <p className="mt-1 text-sm text-ink-500">{vendor.ownerName} · {vendor.category}</p>
              <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-ink-400" />
                  {vendor.address}, {vendor.city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={14} className="text-ink-400" />
                  GST: {vendor.gstNumber}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="text-ink-400" />
                  Joined {formatDate(vendor.joinedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {vendor.status === 'pending' && (
              <>
                <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={approve} disabled={updating}>
                  Approve vendor
                </Button>
                <Button variant="danger" icon={<XCircle size={16} />} onClick={reject} disabled={updating}>
                  Reject vendor
                </Button>
              </>
            )}
            {vendor.status === 'active' && (
              <Button variant="danger" icon={<Ban size={16} />} onClick={() => setSuspendOpen(true)} disabled={updating}>
                Suspend vendor
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Verification checklist"
          subtitle="Review each submitted step before approving or rejecting the application"
        />
        {stepError && <InlineAlert message={stepError} className="mx-5 mt-1" />}
        <div className="divide-y divide-ink-100">
          {STEP_DEFS.map((def) => {
            const rows = def.rows(vendorApi!);
            if (!rows) return null;
            const review = vendorApi!.stepReviews?.[def.key];
            const status: StepReviewStatus = review?.status ?? 'pending';
            const busy = stepUpdating === def.key;
            return (
              <div key={def.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-800">{def.title}</h3>
                    <StatusBadge status={status} label={status === 'pending' ? 'Not reviewed' : undefined} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-8! px-3! text-xs!"
                      disabled={busy || status === 'verified'}
                      onClick={() => reviewStep(def.key, 'verified')}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="danger"
                      className="h-8! px-3! text-xs!"
                      disabled={busy || status === 'rejected'}
                      onClick={() => {
                        setRejectStepKey(def.key);
                        setRejectNote('');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                  {rows.map((row) => (
                    <div key={row.label} className="flex justify-between gap-3 sm:justify-start">
                      <dt className="text-ink-400">{row.label}</dt>
                      <dd className="flex items-center gap-1 text-ink-700">
                        {row.value}
                        {row.previewUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({ url: resolveAssetUrl(row.previewUrl!), label: `${def.title} — ${row.label}` })
                            }
                            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-700"
                            title="View document"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {review?.note && (
                  <p className={cn('mt-2 rounded-lg px-3 py-2 text-[13px]', status === 'rejected' ? 'bg-danger-surface text-danger' : 'bg-ink-50 text-ink-600')}>
                    {review.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total orders"
          value={vendor.totalOrders.toLocaleString('en-IN')}
          icon={<ShoppingBag size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(vendor.revenue)}
          icon={<IndianRupee size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Products listed"
          value={vendor.productsCount}
          icon={<Package size={18} />}
          iconColor="#7C3AED"
          iconSurface="var(--color-violet-surface)"
        />
        <StatCard
          label="Commission rate"
          value={`${vendor.commissionRate}%`}
          icon={<Percent size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
      </div>

      <Card className="mt-5">
        <CardHeader title="Vendor activity" subtitle="Products, recent orders and settlement history" />
        <div className="border-b border-ink-100 px-5 py-4">
          <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === 'products' && (
          vendorProducts.length === 0 ? (
            <EmptyState icon={<Package size={22} />} title="No products listed" description="This vendor hasn't added any products yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {vendorProducts.slice(0, ROW_CAP).map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300">
                            <ImageOff size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-800">{p.name}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{p.categoryName}</Td>
                    <Td className="font-semibold text-ink-800">{formatCurrency(p.sellingPrice)}</Td>
                    <Td>{p.stock}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        )}

        {activeTab === 'orders' && (
          vendorOrders.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={22} />} title="No orders yet" description="This vendor has no orders on record." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Placed</Th>
                </Tr>
              </Thead>
              <tbody>
                {vendorOrders.slice(0, ROW_CAP).map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link to={`/orders/${o.id}`} className="font-semibold text-ink-800 hover:text-brand-700">
                        {o.orderNumber ?? o.id}
                      </Link>
                    </Td>
                    <Td>{o.customerName}</Td>
                    <Td>
                      <StatusBadge status={o.status} label={ORDER_STATUS_META[o.status].label} />
                    </Td>
                    <Td className="font-semibold text-ink-800">{formatCurrency(o.total)}</Td>
                    <Td className="text-ink-500">{timeAgo(o.placedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        )}

        {activeTab === 'settlements' && (
          vendorSettlementsData.length === 0 ? (
            <EmptyState icon={<IndianRupee size={22} />} title="No settlements yet" description="Settlements are recorded once an order is marked delivered." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Gross amount</Th>
                  <Th>Commission</Th>
                  <Th>GST on commission</Th>
                  <Th>Net payout</Th>
                  <Th>Settled</Th>
                </Tr>
              </Thead>
              <tbody>
                {vendorSettlementsData.slice(0, ROW_CAP).map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link to={`/orders/${s.orderId}`} className="font-semibold text-ink-800 hover:text-brand-700">
                        {s.orderNumber}
                      </Link>
                    </Td>
                    <Td>{formatCurrency(s.grossAmount)}</Td>
                    <Td>{formatCurrency(s.commissionAmount)} <span className="text-ink-400">({(s.commissionRate * 100).toFixed(0)}%)</span></Td>
                    <Td>{formatCurrency(s.gstOnCommission)}</Td>
                    <Td className="font-semibold text-ink-800">{formatCurrency(s.netPayout)}</Td>
                    <Td className="text-ink-500">{formatDate(s.settledAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        )}
      </Card>

      <Modal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend vendor?"
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmSuspend}>
              Suspend vendor
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {vendor.storeName} will be suspended immediately and removed from the storefront until reinstated. This
          action can be reversed later.
        </p>
      </Modal>

      <Modal
        open={rejectStepKey !== null}
        onClose={() => setRejectStepKey(null)}
        title={`Reject "${STEP_DEFS.find((s) => s.key === rejectStepKey)?.title ?? ''}"`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectStepKey(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectNote.trim() || stepUpdating !== null}
              onClick={() => rejectStepKey && reviewStep(rejectStepKey, 'rejected', rejectNote.trim())}
            >
              Reject step
            </Button>
          </>
        }
      >
        <Field label="Reason for rejection" hint="Shown to the vendor so they know what to fix.">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            placeholder="e.g. Bank account holder name doesn't match GST registered name"
            className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
      </Modal>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.label ?? 'Document'} width={640}>
        {preview && (
          isPdfUrl(preview.url) ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileText size={32} className="text-ink-300" />
              <p className="text-sm text-ink-600">This document is a PDF and can't be previewed inline.</p>
              <a href={preview.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">Open PDF in new tab</Button>
              </a>
            </div>
          ) : (
            <img src={preview.url} alt={preview.label} className="max-h-[70vh] w-full rounded-xl object-contain" />
          )
        )}
      </Modal>
    </div>
  );
}

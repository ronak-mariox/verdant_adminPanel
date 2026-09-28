import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageSearch,
  CheckCircle2,
  XCircle,
  Power,
  Boxes,
  Clock,
  AlertTriangle,
  Loader2,
  ImageOff,
  Download,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Field, Input, SearchInput } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Pagination } from '@/components/ui/Pagination';
import { ReasonModal } from '@/components/ui/ReasonModal';
import type { Product, ProductStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { api, ApiError, fetchAllPaginatedWithMeta, fetchPage, truncationMessage, unwrapList } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/asset';
import { downloadCsv } from '@/lib/csv';
import { useDebounce } from '@/lib/useDebounce';

const PAGE_SIZE = 12;
const LOW_STOCK_THRESHOLD = 5;

const STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
  rejected: 'Rejected',
  draft: 'Draft',
  inactive: 'Inactive',
};

type ApiProductStatus = 'draft' | 'pending' | 'active' | 'inactive' | 'rejected';
type StockFilter = 'low-stock' | 'out-of-stock';
type StatusTab = 'all' | ApiProductStatus | StockFilter;

const SERVER_STATUSES: ApiProductStatus[] = ['active', 'pending', 'rejected', 'draft', 'inactive'];
const TAB_ORDER: StatusTab[] = ['all', 'active', 'pending', 'low-stock', 'out-of-stock', 'rejected', 'draft', 'inactive'];

// ---------------------------------------------------------------------------
// Backend shapes
// ---------------------------------------------------------------------------

interface ApiProductVariant {
  id?: string;
  label: string;
  mrp: number;
  price: number;
  stock: number;
  sku?: string;
  isPrimary?: boolean;
}

interface ApiProduct {
  id: string;
  vendorId: string;
  categoryId: string;
  subcategoryId?: string;
  name: string;
  description?: string;
  brand?: string;
  unit?: string;
  images: string[];
  variants: ApiProductVariant[];
  tags: string[];
  taxRate: number;
  status: ApiProductStatus;
  rejectionReason?: string;
  isAvailable: boolean;
  sku?: string;
  reorderLevel?: number;
  updatedAt: string;
}

interface ApiSubcategory {
  id: string;
  name: string;
}

interface ApiCategory {
  id: string;
  name: string;
  subcategories: ApiSubcategory[];
}

interface ApiVendor {
  id: string;
  phone: string;
  fullName?: string;
  businessInfo?: { displayName?: string };
  storeProfile?: { storeName?: string };
}

function vendorDisplayName(v: ApiVendor): string {
  return v.storeProfile?.storeName || v.businessInfo?.displayName || v.fullName || v.phone;
}

interface Lookups {
  categoryNameById: Map<string, string>;
  subcategoryNameById: Map<string, string>;
  vendorNameById: Map<string, string>;
}

function deriveStatus(p: ApiProduct): ProductStatus {
  const variant = p.variants.find((v) => v.isPrimary) ?? p.variants[0];
  const stock = variant?.stock ?? 0;
  if (p.status !== 'active') return p.status;
  if (stock <= 0) return 'out-of-stock';
  if (stock <= Math.max(LOW_STOCK_THRESHOLD, p.reorderLevel ?? 0)) return 'low-stock';
  return 'active';
}

function mapProduct(p: ApiProduct, lookups: Lookups): Product {
  const variant = p.variants.find((v) => v.isPrimary) ?? p.variants[0];
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? '—',
    image: p.images[0] ? resolveAssetUrl(p.images[0]) : '',
    categoryId: p.categoryId,
    categoryName: lookups.categoryNameById.get(p.categoryId) ?? 'Uncategorised',
    subcategoryId: p.subcategoryId ?? '',
    subcategoryName: p.subcategoryId ? lookups.subcategoryNameById.get(p.subcategoryId) ?? '—' : '—',
    vendorId: p.vendorId,
    vendorName: lookups.vendorNameById.get(p.vendorId) ?? 'Unknown vendor',
    mrp: variant?.mrp ?? 0,
    sellingPrice: variant?.price ?? 0,
    unit: p.unit ?? variant?.label ?? '—',
    stock: variant?.stock ?? 0,
    reorderLevel: p.reorderLevel ?? 0,
    sku: p.sku ?? variant?.sku ?? '—',
    gstRate: p.taxRate,
    status: deriveStatus(p),
    rejectionReason: p.rejectionReason,
    updatedAt: p.updatedAt,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function ProductThumb({ image, name, className }: { image: string; name: string; className?: string }) {
  if (!image) {
    return (
      <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300', className)}>
        <ImageOff size={16} />
      </div>
    );
  }
  return <img src={image} alt={name} className={cn('shrink-0 rounded-lg object-cover', className)} />;
}

// ---------------------------------------------------------------------------
// Edit form (PATCH /admin/products/:id)
// ---------------------------------------------------------------------------

interface VariantDraft {
  id?: string;
  label: string;
  mrp: string;
  price: string;
  stock: string;
  sku: string;
  isPrimary: boolean;
}

interface ProductDraft {
  name: string;
  description: string;
  brand: string;
  unit: string;
  taxRate: string;
  reorderLevel: string;
  variants: VariantDraft[];
}

function toDraft(p: ApiProduct): ProductDraft {
  return {
    name: p.name,
    description: p.description ?? '',
    brand: p.brand ?? '',
    unit: p.unit ?? '',
    taxRate: String(p.taxRate ?? 0),
    reorderLevel: p.reorderLevel != null ? String(p.reorderLevel) : '',
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      mrp: String(v.mrp),
      price: String(v.price),
      stock: String(v.stock),
      sku: v.sku ?? '',
      isPrimary: !!v.isPrimary,
    })),
  };
}

function validateDraft(d: ProductDraft): string | null {
  if (!d.name.trim()) return 'Product name is required';
  if (d.variants.length === 0) return 'At least one variant is required';
  for (const v of d.variants) {
    if (!v.label.trim()) return 'Every variant needs a label';
    const mrp = Number(v.mrp);
    const price = Number(v.price);
    const stock = Number(v.stock);
    if (!Number.isFinite(mrp) || mrp < 0) return `Variant "${v.label}": MRP must be a number ≥ 0`;
    if (!Number.isFinite(price) || price < 0) return `Variant "${v.label}": price must be a number ≥ 0`;
    if (price > mrp) return `Variant "${v.label}": price cannot exceed its MRP`;
    if (!Number.isInteger(stock) || stock < 0) return `Variant "${v.label}": stock must be a whole number ≥ 0`;
  }
  const tax = Number(d.taxRate);
  if (d.taxRate.trim() && (!Number.isFinite(tax) || tax < 0 || tax > 100)) return 'Tax rate must be between 0 and 100';
  const reorder = Number(d.reorderLevel);
  if (d.reorderLevel.trim() && (!Number.isInteger(reorder) || reorder < 0)) return 'Reorder level must be a whole number ≥ 0';
  return null;
}

export function Products() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [truncation, setTruncation] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<'all' | ApiProductStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const isStockFilter = statusFilter === 'low-stock' || statusFilter === 'out-of-stock';

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      try {
        const [categoriesRaw, vendorsRaw] = await Promise.all([
          api.get<ApiCategory[]>('/admin/categories'),
          api.get<ApiVendor[]>('/admin/vendors'),
        ]);
        if (cancelled) return;
        const categories = unwrapList(categoriesRaw);
        const vendors = unwrapList(vendorsRaw);
        setLookups({
          categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
          subcategoryNameById: new Map(categories.flatMap((c) => c.subcategories.map((s) => [s.id, s.name] as const))),
          vendorNameById: new Map(vendors.map((v) => [v.id, vendorDisplayName(v)])),
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(errorMessage(err, 'Failed to load products'));
          setLoading(false);
        }
      }
    }
    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        const results = await Promise.all([
          fetchPage<ApiProduct>('/admin/products', { limit: 1 }),
          ...SERVER_STATUSES.map((status) => fetchPage<ApiProduct>('/admin/products', { status, limit: 1 })),
        ]);
        if (cancelled) return;
        const next: Partial<Record<'all' | ApiProductStatus, number>> = { all: results[0].total };
        SERVER_STATUSES.forEach((status, i) => {
          next[status] = results[i + 1].total;
        });
        setCounts(next);
      } catch {
        // Counts are decorative; the list itself reports its own errors.
      }
    }
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!lookups) return;
    let cancelled = false;
    async function loadProducts() {
      setLoading(true);
      setLoadError(null);
      try {
        const search = debouncedSearch || undefined;
        if (statusFilter === 'low-stock' || statusFilter === 'out-of-stock') {
          // Stock states are derived client-side, so pull every active product
          // (capped) and filter locally.
          const res = await fetchAllPaginatedWithMeta<ApiProduct>('/admin/products', { status: 'active', search });
          if (cancelled) return;
          const matched = res.items.filter((p) => deriveStatus(p) === statusFilter);
          setApiProducts(matched);
          setTotal(matched.length);
          setTruncation(res.truncated ? truncationMessage(res.total, res.items.length) : null);
        } else {
          const res = await fetchPage<ApiProduct>('/admin/products', {
            status: statusFilter === 'all' ? undefined : statusFilter,
            search,
            page,
            limit: PAGE_SIZE,
          });
          if (cancelled) return;
          setApiProducts(res.items);
          setTotal(res.total);
          setTruncation(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load products'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [lookups, statusFilter, debouncedSearch, page, reloadKey]);

  const products = useMemo(() => (lookups ? apiProducts.map((p) => mapProduct(p, lookups)) : []), [apiProducts, lookups]);

  const tabItems: TabItem[] = TAB_ORDER.map((tab) => ({
    value: tab,
    label: tab === 'all' ? 'All' : STATUS_LABELS[tab],
    count: tab === 'low-stock' || tab === 'out-of-stock' ? undefined : counts[tab],
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = isStockFilter ? products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : products;

  const selectedApi = apiProducts.find((p) => p.id === selectedId) ?? null;
  const selectedProduct = products.find((p) => p.id === selectedId) ?? null;

  function replaceProduct(updated: ApiProduct) {
    setApiProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function setProductStatus(id: string, status: 'active' | 'inactive' | 'rejected', rejectionReason?: string) {
    setActionError(null);
    setBusy(true);
    try {
      const updated = await api.patch<ApiProduct>(`/admin/products/${id}/status`, { status, rejectionReason });
      replaceProduct(updated);
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update product status'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setEditing(false);
    setDraft(null);
    setDraftError(null);
  }

  async function startEditing() {
    if (!selectedId) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const fresh = await api.get<ApiProduct>(`/admin/products/${selectedId}`);
      replaceProduct(fresh);
      setDraft(toDraft(fresh));
      setEditing(true);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to load product'));
    } finally {
      setDraftLoading(false);
    }
  }

  async function saveDraft() {
    if (!selectedId || !draft) return;
    const validation = validateDraft(draft);
    if (validation) {
      setDraftError(validation);
      return;
    }
    setBusy(true);
    setDraftError(null);
    try {
      const hasPrimary = draft.variants.some((v) => v.isPrimary);
      const updated = await api.patch<ApiProduct>(`/admin/products/${selectedId}`, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        brand: draft.brand.trim() || null,
        unit: draft.unit.trim() || null,
        taxRate: draft.taxRate.trim() ? Number(draft.taxRate) : 0,
        reorderLevel: draft.reorderLevel.trim() ? Number(draft.reorderLevel) : null,
        variants: draft.variants.map((v, i) => ({
          ...(v.id ? { id: v.id } : {}),
          label: v.label.trim(),
          mrp: Number(v.mrp),
          price: Number(v.price),
          stock: Number(v.stock),
          sku: v.sku.trim() || null,
          isPrimary: hasPrimary ? v.isPrimary : i === 0,
        })),
      });
      replaceProduct(updated);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setDraftError(errorMessage(err, 'Failed to save product'));
    } finally {
      setBusy(false);
    }
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            variants: prev.variants.map((v, i) =>
              i === index ? { ...v, ...patch } : patch.isPrimary ? { ...v, isPrimary: false } : v,
            ),
          }
        : prev,
    );
  }

  async function exportCsv() {
    if (!lookups) return;
    setExporting(true);
    setActionError(null);
    try {
      const search = debouncedSearch || undefined;
      const res = await fetchAllPaginatedWithMeta<ApiProduct>('/admin/products', {
        status: statusFilter === 'all' ? undefined : isStockFilter ? 'active' : statusFilter,
        search,
      });
      const rows = res.items
        .map((p) => mapProduct(p, lookups))
        .filter((p) => !isStockFilter || p.status === statusFilter)
        .map((p) => [
          p.id,
          p.name,
          p.brand,
          p.categoryName,
          p.subcategoryName,
          p.vendorName,
          p.sku,
          p.mrp,
          p.sellingPrice,
          p.stock,
          p.unit,
          p.gstRate,
          STATUS_LABELS[p.status],
          p.updatedAt,
        ]);
      downloadCsv(
        `products-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
        ['ID', 'Name', 'Brand', 'Category', 'Subcategory', 'Vendor', 'SKU', 'MRP', 'Selling price', 'Stock', 'Unit', 'GST %', 'Status', 'Updated at'],
        rows,
      );
      if (res.truncated) setActionError(truncationMessage(res.total, res.items.length));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to export products'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Browse and moderate the vendor product catalog listed under each category."
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={exportCsv} loading={exporting} disabled={!lookups}>
            Export CSV
          </Button>
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Total products"
          value={counts.all ?? '—'}
          icon={<Boxes size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Pending approval"
          value={counts.pending ?? '—'}
          icon={<Clock size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Active listings"
          value={counts.active ?? '—'}
          icon={<CheckCircle2 size={18} />}
          iconColor="#12866F"
          iconSurface="var(--color-success-surface)"
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <SearchInput
            placeholder="Search by product name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full md:max-w-xs"
          />
        </div>

        <div className="overflow-x-auto px-5 py-4">
          <Tabs
            items={tabItems}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as StatusTab);
              setPage(1);
            }}
          />
        </div>

        {truncation && <InlineAlert tone="warning" message={truncation} className="mx-5 mb-4" />}

        {loading ? (
          <EmptyState icon={<Loader2 size={22} className="animate-spin" />} title="Loading products…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Couldn't load products"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : pageItems.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={22} />}
            title="No products match your filters"
            description="Try adjusting your search or status filter."
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Category / Subcategory</Th>
                  <Th>Vendor</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </Thead>
              <tbody>
                {pageItems.map((product) => (
                  <Tr key={product.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <ProductThumb image={product.image} name={product.name} className="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-800">{product.name}</p>
                          <p className="text-[12px] text-ink-500">{product.brand}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-ink-700">{product.categoryName}</p>
                      <p className="text-[12px] text-ink-500">{product.subcategoryName}</p>
                    </Td>
                    <Td>
                      <Link to={`/vendors/${product.vendorId}`} className="text-ink-700 hover:text-brand-700">
                        {product.vendorName}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink-800">{formatCurrency(product.sellingPrice)}</span>
                        {product.mrp !== product.sellingPrice && (
                          <span className="text-[12px] text-ink-400 line-through">{formatCurrency(product.mrp)}</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          'font-medium',
                          product.status === 'out-of-stock'
                            ? 'text-danger'
                            : product.status === 'low-stock'
                              ? 'text-warning'
                              : 'text-ink-700',
                        )}
                      >
                        {product.stock}
                      </span>
                      <span className="ml-1 text-[12px] text-ink-400">{product.unit}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={product.status} label={STATUS_LABELS[product.status]} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-500">{formatDate(product.updatedAt)}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(product.id)}>
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} total={total} pageSize={PAGE_SIZE} />
          </>
        )}
      </Card>

      <Drawer
        open={!!selectedProduct}
        onClose={closeDrawer}
        title={selectedProduct?.name ?? ''}
        subtitle={selectedProduct ? `${selectedProduct.categoryName} · ${selectedProduct.subcategoryName}` : undefined}
        width={editing ? 560 : 480}
        footer={
          selectedProduct &&
          (editing ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                  setDraftError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={saveDraft} loading={busy}>
                Save changes
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" icon={<Pencil size={15} />} onClick={startEditing} loading={draftLoading} disabled={busy}>
                Edit
              </Button>
              {selectedProduct.status === 'pending' ? (
                <>
                  <Button variant="danger" icon={<XCircle size={15} />} onClick={() => setRejectTarget(selectedProduct)} disabled={busy}>
                    Reject
                  </Button>
                  <Button icon={<CheckCircle2 size={15} />} onClick={() => setProductStatus(selectedProduct.id, 'active')} loading={busy}>
                    Approve
                  </Button>
                </>
              ) : selectedProduct.status === 'rejected' || selectedProduct.status === 'draft' || selectedProduct.status === 'inactive' ? (
                <Button icon={<Power size={15} />} onClick={() => setProductStatus(selectedProduct.id, 'active')} loading={busy}>
                  Activate
                </Button>
              ) : (
                <Button variant="outline" icon={<Power size={15} />} onClick={() => setProductStatus(selectedProduct.id, 'inactive')} loading={busy}>
                  Deactivate
                </Button>
              )}
            </div>
          ))
        }
      >
        {selectedProduct && editing && draft ? (
          <div className="space-y-4">
            {draftError && <InlineAlert message={draftError} />}
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand">
                <Input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
              </Field>
              <Field label="Unit">
                <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="kg, pack…" />
              </Field>
              <Field label="GST rate (%)">
                <Input type="number" min={0} max={100} value={draft.taxRate} onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })} />
              </Field>
              <Field label="Reorder level">
                <Input type="number" min={0} step={1} value={draft.reorderLevel} onChange={(e) => setDraft({ ...draft, reorderLevel: e.target.value })} />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-ink-700">Variants</p>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus size={13} />}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: [...draft.variants, { label: '', mrp: '', price: '', stock: '0', sku: '', isPrimary: draft.variants.length === 0 }],
                    })
                  }
                >
                  Add variant
                </Button>
              </div>
              <div className="space-y-2">
                {draft.variants.map((v, i) => (
                  <div key={v.id ?? `new-${i}`} className="space-y-2 rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center gap-2">
                      <Input value={v.label} onChange={(e) => updateVariant(i, { label: e.target.value })} placeholder="Label (e.g. 500 g)" className="h-8 text-[13px]" />
                      <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-600">
                        <input type="radio" name="primary-variant" checked={v.isPrimary} onChange={() => updateVariant(i, { isPrimary: true })} />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}
                        disabled={draft.variants.length === 1}
                        className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-danger-surface hover:text-danger disabled:opacity-40"
                        title="Remove variant"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Input type="number" min={0} value={v.mrp} onChange={(e) => updateVariant(i, { mrp: e.target.value })} placeholder="MRP" className="h-8 text-[12px]" />
                      <Input type="number" min={0} value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })} placeholder="Price" className="h-8 text-[12px]" />
                      <Input type="number" min={0} step={1} value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} placeholder="Stock" className="h-8 text-[12px]" />
                      <Input value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} placeholder="SKU" className="h-8 text-[12px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : selectedProduct ? (
          <div className="space-y-5">
            <ProductThumb image={selectedProduct.image} name={selectedProduct.name} className="h-48 w-full" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-ink-900">{selectedProduct.name}</p>
                <p className="text-[13px] text-ink-500">{selectedProduct.brand}</p>
              </div>
              <StatusBadge status={selectedProduct.status} label={STATUS_LABELS[selectedProduct.status]} />
            </div>

            {selectedProduct.status === 'rejected' && selectedProduct.rejectionReason && (
              <InlineAlert message={`Rejected: ${selectedProduct.rejectionReason}`} />
            )}

            {selectedApi?.description && <p className="text-[13px] text-ink-600">{selectedApi.description}</p>}

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-ink-200 p-4 text-[13px]">
              <div>
                <p className="text-ink-400">Selling price</p>
                <p className="font-semibold text-ink-800">{formatCurrency(selectedProduct.sellingPrice)}</p>
              </div>
              <div>
                <p className="text-ink-400">MRP</p>
                <p className={cn('font-semibold', selectedProduct.mrp !== selectedProduct.sellingPrice ? 'text-ink-400 line-through' : 'text-ink-800')}>
                  {formatCurrency(selectedProduct.mrp)}
                </p>
              </div>
              <div>
                <p className="text-ink-400">Stock</p>
                <p className="font-semibold text-ink-800">
                  {selectedProduct.stock} {selectedProduct.unit}
                </p>
              </div>
              <div>
                <p className="text-ink-400">Reorder level</p>
                <p className="font-semibold text-ink-800">{selectedProduct.reorderLevel}</p>
              </div>
              <div>
                <p className="text-ink-400">SKU</p>
                <p className="font-semibold text-ink-800">{selectedProduct.sku}</p>
              </div>
              <div>
                <p className="text-ink-400">GST rate</p>
                <p className="font-semibold text-ink-800">{selectedProduct.gstRate}%</p>
              </div>
              <div>
                <p className="text-ink-400">Last updated</p>
                <p className="font-semibold text-ink-800">{formatDate(selectedProduct.updatedAt)}</p>
              </div>
            </div>

            {selectedApi && selectedApi.variants.length > 1 && (
              <div className="rounded-xl border border-ink-200 p-4 text-[13px]">
                <p className="mb-2 text-ink-400">Variants</p>
                <ul className="divide-y divide-ink-100">
                  {selectedApi.variants.map((v, i) => (
                    <li key={v.id ?? i} className="flex items-center justify-between py-1.5">
                      <span className="font-medium text-ink-800">
                        {v.label}
                        {v.isPrimary && <span className="ml-1.5 text-[11px] text-brand-700">primary</span>}
                      </span>
                      <span className="text-ink-600">
                        {formatCurrency(v.price)} · {v.stock} in stock
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-ink-200 p-4 text-[13px]">
              <p className="text-ink-400">Vendor</p>
              <Link to={`/vendors/${selectedProduct.vendorId}`} className="font-semibold text-ink-800 hover:text-brand-700">
                {selectedProduct.vendorName}
              </Link>
            </div>

            <div className="rounded-xl border border-ink-200 p-4 text-[13px]">
              <p className="text-ink-400">Category</p>
              <p className="font-semibold text-ink-800">
                {selectedProduct.categoryName} <span className="font-normal text-ink-400">/</span> {selectedProduct.subcategoryName}
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ReasonModal
        open={rejectTarget !== null}
        title="Reject product"
        description={rejectTarget ? `${rejectTarget.name} · ${rejectTarget.vendorName}` : undefined}
        label="Rejection reason"
        hint="Sent to the vendor so they can fix the listing and resubmit."
        confirmLabel="Reject product"
        busy={busy}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          const ok = await setProductStatus(rejectTarget.id, 'rejected', reason);
          if (ok) setRejectTarget(null);
        }}
      />
    </div>
  );
}

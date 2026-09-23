import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageSearch,
  Star,
  CheckCircle2,
  XCircle,
  Power,
  Boxes,
  Clock,
  AlertTriangle,
  PackageX,
  Loader2,
  ImageOff,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { SearchInput, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Pagination } from '@/components/ui/Pagination';
import type { Product, ProductStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { api, ApiError, fetchAllPaginated } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/asset';

const PAGE_SIZE = 12;

const STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
  rejected: 'Rejected',
  draft: 'Draft',
  inactive: 'Inactive',
};

const STATUS_ORDER: ProductStatus[] = ['active', 'pending', 'low-stock', 'out-of-stock', 'rejected', 'draft', 'inactive'];

// ---------------------------------------------------------------------------
// Backend shapes
// ---------------------------------------------------------------------------

interface ApiProductVariant {
  id: string;
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
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'rejected';
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

function mapProduct(
  p: ApiProduct,
  categoryNameById: Map<string, string>,
  subcategoryNameById: Map<string, string>,
  vendorNameById: Map<string, string>,
): Product {
  const variant = p.variants.find((v) => v.isPrimary) ?? p.variants[0];
  const mrp = variant?.mrp ?? 0;
  const sellingPrice = variant?.price ?? 0;
  const stock = variant?.stock ?? 0;

  let status: ProductStatus;
  if (p.status === 'active') {
    if (stock <= 0) status = 'out-of-stock';
    else if (p.reorderLevel != null && stock <= p.reorderLevel) status = 'low-stock';
    else status = 'active';
  } else if (p.status === 'pending') {
    status = 'pending';
  } else if (p.status === 'rejected') {
    status = 'rejected';
  } else if (p.status === 'inactive') {
    status = 'inactive';
  } else {
    status = 'draft';
  }

  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? '—',
    image: p.images[0] ? resolveAssetUrl(p.images[0]) : '',
    categoryId: p.categoryId,
    categoryName: categoryNameById.get(p.categoryId) ?? 'Uncategorised',
    subcategoryId: p.subcategoryId ?? '',
    subcategoryName: p.subcategoryId ? subcategoryNameById.get(p.subcategoryId) ?? '—' : '—',
    vendorId: p.vendorId,
    vendorName: vendorNameById.get(p.vendorId) ?? 'Unknown vendor',
    mrp,
    sellingPrice,
    unit: p.unit ?? variant?.label ?? '—',
    stock,
    reorderLevel: p.reorderLevel ?? 0,
    sku: p.sku ?? variant?.sku ?? '—',
    gstRate: p.taxRate,
    status,
    rating: 0,
    ratingCount: 0,
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

export function Products() {
  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
  const [categoriesList, setCategoriesList] = useState<ApiCategory[]>([]);
  const [vendorsList, setVendorsList] = useState<ApiVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [productsRaw, categoriesRaw, vendorsRaw] = await Promise.all([
          fetchAllPaginated<ApiProduct>('/admin/products'),
          api.get<ApiCategory[]>('/admin/categories'),
          api.get<ApiVendor[]>('/admin/vendors'),
        ]);
        if (cancelled) return;
        setApiProducts(productsRaw);
        setCategoriesList(categoriesRaw);
        setVendorsList(vendorsRaw);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load products'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const categoryNameById = useMemo(() => new Map(categoriesList.map((c) => [c.id, c.name])), [categoriesList]);
  const subcategoryNameById = useMemo(
    () => new Map(categoriesList.flatMap((c) => c.subcategories.map((s) => [s.id, s.name] as const))),
    [categoriesList],
  );
  const vendorNameById = useMemo(
    () => new Map(vendorsList.map((v) => [v.id, vendorDisplayName(v)])),
    [vendorsList],
  );

  const productsState = useMemo(
    () => apiProducts.map((p) => mapProduct(p, categoryNameById, subcategoryNameById, vendorNameById)),
    [apiProducts, categoryNameById, subcategoryNameById, vendorNameById],
  );

  const summary = useMemo(() => {
    const total = productsState.length;
    const pending = productsState.filter((p) => p.status === 'pending').length;
    const lowStock = productsState.filter((p) => p.status === 'low-stock').length;
    const outOfStock = productsState.filter((p) => p.status === 'out-of-stock').length;
    return { total, pending, lowStock, outOfStock };
  }, [productsState]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: productsState.length };
    for (const status of STATUS_ORDER) counts[status] = 0;
    for (const p of productsState) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }, [productsState]);

  const tabItems: TabItem[] = [
    { value: 'all', label: 'All', count: statusCounts.all },
    ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status], count: statusCounts[status] ?? 0 })),
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productsState.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [productsState, search, categoryFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const selectedProduct = productsState.find((p) => p.id === selectedId) ?? null;

  async function setProductStatus(id: string, status: 'active' | 'inactive' | 'rejected') {
    setActionError(null);
    try {
      const updated = await api.patch<ApiProduct>(`/admin/products/${id}/status`, { status });
      setApiProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update product status'));
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Browse and moderate the vendor product catalog listed under each category."
        actions={
          <Button variant="outline" disabled>
            Export
          </Button>
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total products"
          value={summary.total}
          icon={<Boxes size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Pending approval"
          value={summary.pending}
          icon={<Clock size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Low stock"
          value={summary.lowStock}
          icon={<AlertTriangle size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Out of stock"
          value={summary.outOfStock}
          icon={<PackageX size={18} />}
          iconColor="#E11D48"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <SearchInput
              placeholder="Search by name, brand or SKU..."
              value={search}
              onChange={(e) => updateFilter(() => setSearch(e.target.value))}
              className="sm:max-w-xs"
            />
            <Select
              value={categoryFilter}
              onChange={(e) => updateFilter(() => setCategoryFilter(e.target.value))}
              className="sm:w-56"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="px-5 py-4">
          <Tabs
            items={tabItems}
            value={statusFilter}
            onChange={(v) => updateFilter(() => setStatusFilter(v as ProductStatus | 'all'))}
          />
        </div>

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
            description="Try adjusting your search, category or status filters."
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
                  <Th>Rating</Th>
                  <Th>Status</Th>
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
                      <div className="flex items-center gap-1 text-ink-700">
                        <Star size={13} className="fill-warning text-warning" />
                        {product.rating.toFixed(1)}
                        <span className="text-[12px] text-ink-400">({product.ratingCount})</span>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={product.status} label={STATUS_LABELS[product.status]} />
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(product.id)}>
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
              total={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </Card>

      <Drawer
        open={!!selectedProduct}
        onClose={() => setSelectedId(null)}
        title={selectedProduct?.name ?? ''}
        subtitle={selectedProduct ? `${selectedProduct.categoryName} · ${selectedProduct.subcategoryName}` : undefined}
        footer={
          selectedProduct && (
            <div className="flex justify-end gap-2">
              {selectedProduct.status === 'pending' ? (
                <>
                  <Button
                    variant="danger"
                    icon={<XCircle size={15} />}
                    onClick={() => setProductStatus(selectedProduct.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    icon={<CheckCircle2 size={15} />}
                    onClick={() => setProductStatus(selectedProduct.id, 'active')}
                  >
                    Approve
                  </Button>
                </>
              ) : selectedProduct.status === 'rejected' || selectedProduct.status === 'draft' || selectedProduct.status === 'inactive' ? (
                <Button icon={<Power size={15} />} onClick={() => setProductStatus(selectedProduct.id, 'active')}>
                  Activate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  icon={<Power size={15} />}
                  onClick={() => setProductStatus(selectedProduct.id, 'inactive')}
                >
                  Deactivate
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedProduct && (
          <div className="space-y-5">
            <ProductThumb image={selectedProduct.image} name={selectedProduct.name} className="h-48 w-full" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-ink-900">{selectedProduct.name}</p>
                <p className="text-[13px] text-ink-500">{selectedProduct.brand}</p>
              </div>
              <StatusBadge status={selectedProduct.status} label={STATUS_LABELS[selectedProduct.status]} />
            </div>

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
                <p className="text-ink-400">Rating</p>
                <p className="flex items-center gap-1 font-semibold text-ink-800">
                  <Star size={13} className="fill-warning text-warning" />
                  {selectedProduct.rating.toFixed(1)} ({selectedProduct.ratingCount})
                </p>
              </div>
              <div>
                <p className="text-ink-400">Last updated</p>
                <p className="font-semibold text-ink-800">{formatDate(selectedProduct.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-ink-200 p-4 text-[13px]">
              <p className="text-ink-400">Vendor</p>
              <Link
                to={`/vendors/${selectedProduct.vendorId}`}
                className="font-semibold text-ink-800 hover:text-brand-700"
              >
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
        )}
      </Drawer>
    </div>
  );
}

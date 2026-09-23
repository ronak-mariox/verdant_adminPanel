import { useEffect, useMemo, useState } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Home,
  Eye,
  EyeOff,
  Layers,
  Package,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { Category, CatalogStatus, Subcategory, CategoryVariantConfig } from '@/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

// Decorative-only gradient pair, hashed from the category id so it's stable across
// reloads without the backend needing to store it (Category has no colorFrom/colorTo
// field server-side — see admin panel README notes on Category type).
const GRADIENT_PALETTE: [string, string][] = [
  ['#4ADE80', '#16A34A'],
  ['#93C5FD', '#2563EB'],
  ['#BBF7D0', '#15803D'],
  ['#FDE68A', '#D97706'],
  ['#FBCFE8', '#BE185D'],
  ['#A5F3FC', '#0E7490'],
  ['#DDD6FE', '#6D28D9'],
  ['#FCA5A5', '#B91C1C'],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function gradientFor(id: string): [string, string] {
  return GRADIENT_PALETTE[hashString(id) % GRADIENT_PALETTE.length];
}

const placeholderImage = (seed: string) => `https://picsum.photos/seed/${slugify(seed)}/200/200`;

// ---------------------------------------------------------------------------
// Backend shapes (GET /admin/categories) — mapped into the admin panel's local
// Category/Subcategory types below.
// ---------------------------------------------------------------------------

interface ApiSubcategory {
  id: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  variantConfig?: CategoryVariantConfig;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  showOnHome: boolean;
  subcategories: ApiSubcategory[];
  variantConfig?: CategoryVariantConfig;
}

function mapCategory(c: ApiCategory): Category {
  const [colorFrom, colorTo] = gradientFor(c.id);
  return {
    id: c.id,
    name: c.name,
    image: c.imageUrl || placeholderImage(c.name),
    colorFrom,
    colorTo,
    order: c.sortOrder,
    status: c.isActive ? 'active' : 'inactive',
    showOnHome: c.showOnHome,
    subcategories: c.subcategories.map((s) => mapSubcategory(s, c.id)),
    variantConfig: c.variantConfig,
  };
}

function mapSubcategory(s: ApiSubcategory, categoryId: string): Subcategory {
  return {
    id: s.id,
    categoryId,
    name: s.name,
    image: s.imageUrl || placeholderImage(s.name),
    productCount: 0, // no backend field yet — not worth a full product fetch from this page
    status: s.isActive ? 'active' : 'inactive',
    variantConfig: s.variantConfig,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// 'inherit' means this subcategory has no override and uses the parent category's
// own variantConfig — distinct from CategoryVariantConfig['kind'], which has no
// concept of "no override" since it's the shape sent to the backend.
type SubVariantKind = 'inherit' | CategoryVariantConfig['kind'];

interface DraftSubcategory {
  id: string;
  isNew: boolean;
  name: string;
  productCount: number;
  status: CatalogStatus;
  variantKind: SubVariantKind;
  variantLabel: string;
  variantValues: string;
}

const defaultVariantLabel = (kind: CategoryVariantConfig['kind']) =>
  kind === 'weight_volume' ? 'Weight/Volume' : 'Size';

const defaultVariantValues = (kind: CategoryVariantConfig['kind']) =>
  kind === 'weight_volume' ? 'g, kg, ml, L, pcs' : 'XS, S, M, L, XL, XXL';

interface DraftCategory {
  id: string | null;
  name: string;
  image: string;
  colorFrom: string;
  colorTo: string;
  order: number;
  status: CatalogStatus;
  showOnHome: boolean;
  subcategories: DraftSubcategory[];
  variantKind: CategoryVariantConfig['kind'];
  variantLabel: string;
  variantValues: string;
}

const emptyDraft = (nextOrder: number): DraftCategory => ({
  id: null,
  name: '',
  image: '',
  colorFrom: '#4ADE80',
  colorTo: '#16A34A',
  order: nextOrder,
  status: 'active',
  showOnHome: true,
  subcategories: [],
  variantKind: 'weight_volume',
  variantLabel: 'Weight/Volume',
  variantValues: 'g, kg, ml, L, pcs',
});

const toDraft = (category: Category): DraftCategory => ({
  id: category.id,
  name: category.name,
  image: category.image,
  colorFrom: category.colorFrom,
  colorTo: category.colorTo,
  order: category.order,
  status: category.status,
  showOnHome: category.showOnHome,
  subcategories: category.subcategories.map((s) => ({
    id: s.id,
    isNew: false,
    name: s.name,
    productCount: s.productCount,
    status: s.status,
    variantKind: s.variantConfig?.kind ?? 'inherit',
    variantLabel: s.variantConfig?.label ?? defaultVariantLabel(s.variantConfig?.kind ?? 'weight_volume'),
    variantValues:
      (s.variantConfig?.kind === 'attribute' ? s.variantConfig.options : s.variantConfig?.units)?.join(', ') ??
      defaultVariantValues(s.variantConfig?.kind ?? 'weight_volume'),
  })),
  variantKind: category.variantConfig?.kind ?? 'weight_volume',
  variantLabel: category.variantConfig?.label ?? 'Weight/Volume',
  variantValues: (
    category.variantConfig?.kind === 'attribute'
      ? category.variantConfig.options
      : category.variantConfig?.units
  )?.join(', ') ?? 'g, kg, ml, L, pcs',
});

export function Categories() {
  const [categoriesState, setCategoriesState] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftCategory>(emptyDraft(1));
  const [newSubName, setNewSubName] = useState('');
  const [removedSubIds, setRemovedSubIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<ApiCategory[]>('/admin/categories');
        if (!cancelled) setCategoriesState(data.map(mapCategory));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load categories'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const sortedCategories = useMemo(
    () => [...categoriesState].sort((a, b) => a.order - b.order),
    [categoriesState],
  );

  const openAddDrawer = () => {
    const nextOrder = categoriesState.length
      ? Math.max(...categoriesState.map((c) => c.order)) + 1
      : 1;
    setDraft(emptyDraft(nextOrder));
    setNewSubName('');
    setRemovedSubIds([]);
    setDrawerError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (category: Category) => {
    setDraft(toDraft(category));
    setNewSubName('');
    setRemovedSubIds([]);
    setDrawerError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  async function toggleCategoryStatus(id: string) {
    const current = categoriesState.find((c) => c.id === id);
    if (!current) return;
    setActionError(null);
    try {
      const updated = await api.patch<ApiCategory>(`/admin/categories/${id}`, {
        isActive: current.status !== 'active',
      });
      setCategoriesState((prev) => prev.map((c) => (c.id === id ? mapCategory(updated) : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update category status'));
    }
  }

  async function toggleShowOnHome(id: string) {
    const current = categoriesState.find((c) => c.id === id);
    if (!current) return;
    setActionError(null);
    try {
      const updated = await api.patch<ApiCategory>(`/admin/categories/${id}`, {
        showOnHome: !current.showOnHome,
      });
      setCategoriesState((prev) => prev.map((c) => (c.id === id ? mapCategory(updated) : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update category'));
    }
  }

  async function toggleSubcategoryStatus(categoryId: string, subId: string) {
    const category = categoriesState.find((c) => c.id === categoryId);
    const sub = category?.subcategories.find((s) => s.id === subId);
    if (!sub) return;
    setActionError(null);
    try {
      const updated = await api.patch<ApiCategory>(
        `/admin/categories/${categoryId}/subcategories/${subId}`,
        { isActive: sub.status !== 'active' },
      );
      setCategoriesState((prev) => prev.map((c) => (c.id === categoryId ? mapCategory(updated) : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update subcategory'));
    }
  }

  async function removeSubcategory(categoryId: string, subId: string) {
    setActionError(null);
    try {
      const updated = await api.delete<ApiCategory>(
        `/admin/categories/${categoryId}/subcategories/${subId}`,
      );
      setCategoriesState((prev) => prev.map((c) => (c.id === categoryId ? mapCategory(updated) : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to remove subcategory'));
    }
  }

  const addDraftSubcategory = () => {
    const name = newSubName.trim();
    if (!name) return;
    setDraft((prev) => ({
      ...prev,
      subcategories: [
        ...prev.subcategories,
        {
          id: `sub-${slugify(name)}-${Date.now()}`,
          isNew: true,
          name,
          productCount: 0,
          status: 'active',
          variantKind: 'inherit',
          variantLabel: '',
          variantValues: '',
        },
      ],
    }));
    setNewSubName('');
  };

  const removeDraftSubcategory = (id: string) => {
    const sub = draft.subcategories.find((s) => s.id === id);
    if (sub && !sub.isNew) {
      setRemovedSubIds((prev) => [...prev, id]);
    }
    setDraft((prev) => ({ ...prev, subcategories: prev.subcategories.filter((s) => s.id !== id) }));
  };

  const renameDraftSubcategory = (id: string, name: string) => {
    setDraft((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  };

  const toggleDraftSubcategoryStatus = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s,
      ),
    }));
  };

  const setDraftSubcategoryVariantKind = (id: string, kind: SubVariantKind) => {
    setDraft((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((s) =>
        s.id === id
          ? {
              ...s,
              variantKind: kind,
              variantLabel: kind === 'inherit' ? '' : defaultVariantLabel(kind),
              variantValues: kind === 'inherit' ? '' : defaultVariantValues(kind),
            }
          : s,
      ),
    }));
  };

  const setDraftSubcategoryVariantField = (id: string, field: 'variantLabel' | 'variantValues', value: string) => {
    setDraft((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  async function saveDraft() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setDrawerError(null);
    try {
      const variantValues = draft.variantValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const variantConfig: CategoryVariantConfig = {
        kind: draft.variantKind,
        label: draft.variantLabel.trim() || (draft.variantKind === 'weight_volume' ? 'Weight/Volume' : 'Size'),
        ...(draft.variantKind === 'weight_volume' ? { units: variantValues } : { options: variantValues }),
      };

      const payload = {
        name: draft.name.trim(),
        imageUrl: draft.image.trim() || undefined,
        sortOrder: draft.order,
        isActive: draft.status === 'active',
        showOnHome: draft.showOnHome,
        variantConfig,
      };

      let categoryId = draft.id;
      let updated: ApiCategory;
      if (categoryId) {
        updated = await api.patch<ApiCategory>(`/admin/categories/${categoryId}`, payload);
      } else {
        updated = await api.post<ApiCategory>('/admin/categories', payload);
        categoryId = updated.id;
      }

      for (const subId of removedSubIds) {
        updated = await api.delete<ApiCategory>(`/admin/categories/${categoryId}/subcategories/${subId}`);
      }

      for (const sub of draft.subcategories) {
        const trimmedName = sub.name.trim();
        if (!trimmedName) continue;

        const subVariantValues = sub.variantValues
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        // null explicitly clears a previously-set override so the subcategory falls
        // back to the category's own variantConfig; undefined (new subcategory,
        // never touched) just omits the field.
        const subVariantConfig: CategoryVariantConfig | null | undefined =
          sub.variantKind === 'inherit'
            ? sub.isNew
              ? undefined
              : null
            : {
                kind: sub.variantKind,
                label: sub.variantLabel.trim() || defaultVariantLabel(sub.variantKind),
                ...(sub.variantKind === 'weight_volume' ? { units: subVariantValues } : { options: subVariantValues }),
              };

        if (sub.isNew) {
          updated = await api.post<ApiCategory>(`/admin/categories/${categoryId}/subcategories`, {
            name: trimmedName,
            variantConfig: subVariantConfig,
          });
          if (sub.status === 'inactive') {
            const created = updated.subcategories[updated.subcategories.length - 1];
            if (created) {
              updated = await api.patch<ApiCategory>(
                `/admin/categories/${categoryId}/subcategories/${created.id}`,
                { isActive: false },
              );
            }
          }
        } else {
          updated = await api.patch<ApiCategory>(`/admin/categories/${categoryId}/subcategories/${sub.id}`, {
            name: trimmedName,
            isActive: sub.status === 'active',
            variantConfig: subVariantConfig,
          });
        }
      }

      const mapped = mapCategory(updated);
      setCategoriesState((prev) => {
        const exists = prev.some((c) => c.id === mapped.id);
        return exists ? prev.map((c) => (c.id === mapped.id ? mapped : c)) : [mapped, ...prev];
      });
      setDrawerOpen(false);
    } catch (err) {
      setDrawerError(errorMessage(err, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Manage the taxonomy shown on the Verdant app's home screen category shelf and product browse."
        actions={
          <Button icon={<Plus size={16} />} onClick={openAddDrawer}>
            Add Category
          </Button>
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      {loading ? (
        <Card>
          <EmptyState icon={<Loader2 size={22} className="animate-spin" />} title="Loading categories…" />
        </Card>
      ) : loadError ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Couldn't load categories"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        </Card>
      ) : sortedCategories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers size={22} />}
            title="No categories yet"
            description="Create your first category to start building the Verdant app's home screen shelf."
            action={
              <Button icon={<Plus size={16} />} onClick={openAddDrawer}>
                Add Category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedCategories.map((category) => {
            const totalProducts = category.subcategories.reduce((sum, s) => sum + s.productCount, 0);
            const isExpanded = !!expanded[category.id];
            return (
              <Card key={category.id} className="flex flex-col overflow-hidden">
                <div className="relative">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="h-32 w-full rounded-t-2xl object-cover"
                  />
                  <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold text-ink-700 shadow">
                    {category.order}
                  </span>
                  <button
                    onClick={() => toggleShowOnHome(category.id)}
                    title={category.showOnHome ? 'Shown on home shelf' : 'Hidden from home shelf'}
                    className={cn(
                      'absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow',
                      category.showOnHome ? 'bg-brand-600 text-white' : 'bg-white/90 text-ink-500',
                    )}
                  >
                    <Home size={12} />
                    {category.showOnHome ? 'On home' : 'Hidden'}
                  </button>
                </div>

                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-[15px] font-semibold text-ink-900">{category.name}</h3>
                    <StatusBadge status={category.status} />
                  </div>

                  <div className="flex items-center gap-4 text-[12.5px] text-ink-500">
                    <span className="flex items-center gap-1">
                      <Layers size={13} /> {category.subcategories.length} subcategories
                    </span>
                    <span className="flex items-center gap-1">
                      <Package size={13} /> {totalProducts} products
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => openEditDrawer(category)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={category.status === 'active' ? <EyeOff size={13} /> : <Eye size={13} />}
                      onClick={() => toggleCategoryStatus(category.id)}
                    >
                      {category.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button
                      onClick={() => toggleExpanded(category.id)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="-mx-1 mt-1 border-t border-ink-100 pt-3">
                      {category.subcategories.length === 0 ? (
                        <p className="px-1 text-[12.5px] text-ink-400">
                          No subcategories yet. Edit this category to add one.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {category.subcategories.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-ink-50"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    sub.status === 'active' ? 'bg-success' : 'bg-ink-300',
                                  )}
                                />
                                <span className="truncate font-medium text-ink-700">{sub.name}</span>
                                <span className="shrink-0 text-ink-400">· {sub.productCount}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => toggleSubcategoryStatus(category.id, sub.id)}
                                  className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                                  title="Toggle active"
                                >
                                  {sub.status === 'active' ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                                <button
                                  onClick={() => removeSubcategory(category.id, sub.id)}
                                  className="rounded-md p-1 text-ink-400 hover:bg-danger-surface hover:text-danger"
                                  title="Remove subcategory"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={draft.id ? 'Edit Category' : 'Add Category'}
        subtitle={draft.id ? 'Update details shown on the Verdant app' : 'Create a new home screen category'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={!draft.name.trim() || saving} loading={saving}>
              {draft.id ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {drawerError && <InlineAlert message={drawerError} />}

          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Grocery & Staples"
            />
          </Field>

          <Field label="Image URL" hint="Shown as the category tile image in the app">
            <Input
              value={draft.image}
              onChange={(e) => setDraft((prev) => ({ ...prev, image: e.target.value }))}
              placeholder="https://..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as CatalogStatus }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
            <Field label="Display order">
              <Input
                type="number"
                min={1}
                value={draft.order}
                onChange={(e) => setDraft((prev) => ({ ...prev, order: Number(e.target.value) || 1 }))}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-ink-200 px-3.5 py-2.5">
            <div>
              <p className="text-[13px] font-medium text-ink-800">Show on home shelf</p>
              <p className="text-[12px] text-ink-500">Feature this category on the Verdant app home screen</p>
            </div>
            <button
              onClick={() => setDraft((prev) => ({ ...prev, showOnHome: !prev.showOnHome }))}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                draft.showOnHome ? 'bg-brand-600' : 'bg-ink-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  draft.showOnHome ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-ink-200 px-3.5 py-3">
            <div>
              <p className="text-[13px] font-medium text-ink-800">Product Variant Type</p>
              <p className="text-[12px] text-ink-500">
                Controls what unit/size input vendors see when adding a product in this category
              </p>
            </div>

            <Field label="Type">
              <Select
                value={draft.variantKind}
                onChange={(e) => {
                  const kind = e.target.value as CategoryVariantConfig['kind'];
                  setDraft((prev) => ({
                    ...prev,
                    variantKind: kind,
                    variantLabel: kind === 'weight_volume' ? 'Weight/Volume' : 'Size',
                    variantValues: kind === 'weight_volume' ? 'g, kg, ml, L, pcs' : 'XS, S, M, L, XL, XXL',
                  }));
                }}
              >
                <option value="weight_volume">Weight / Volume (e.g. grocery, personal care)</option>
                <option value="attribute">Size / Attribute (e.g. fashion, electronics)</option>
              </Select>
            </Field>

            <Field label="Field label" hint="Shown to vendors above the unit/size input">
              <Input
                value={draft.variantLabel}
                onChange={(e) => setDraft((prev) => ({ ...prev, variantLabel: e.target.value }))}
                placeholder="e.g. Weight/Volume or Size"
              />
            </Field>

            <Field
              label={draft.variantKind === 'weight_volume' ? 'Units' : 'Options'}
              hint="Comma-separated list"
            >
              <Input
                value={draft.variantValues}
                onChange={(e) => setDraft((prev) => ({ ...prev, variantValues: e.target.value }))}
                placeholder={draft.variantKind === 'weight_volume' ? 'g, kg, ml, L, pcs' : 'XS, S, M, L, XL'}
              />
            </Field>

            {draft.variantValues.trim() && (
              <div className="flex flex-wrap gap-1.5">
                {draft.variantValues
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .map((v, i) => (
                    <span
                      key={`${v}-${i}`}
                      className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium text-ink-700"
                    >
                      {v}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div>
            <Field label="Subcategories" hint="Add, rename or remove subcategories for this category">
              <div className="flex gap-2">
                <Input
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="New subcategory name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDraftSubcategory();
                    }
                  }}
                />
                <Button variant="outline" icon={<Plus size={14} />} onClick={addDraftSubcategory}>
                  Add
                </Button>
              </div>
            </Field>

            {draft.subcategories.length > 0 && (
              <ul className="mt-3 space-y-2">
                {draft.subcategories.map((sub) => (
                  <li key={sub.id} className="space-y-2 rounded-xl border border-ink-200 px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={sub.name}
                        onChange={(e) => renameDraftSubcategory(sub.id, e.target.value)}
                        className="h-8 text-[13px]"
                      />
                      <span className="shrink-0 text-[11px] text-ink-400">{sub.productCount} items</span>
                      <button
                        onClick={() => toggleDraftSubcategoryStatus(sub.id)}
                        className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        title="Toggle active"
                      >
                        {sub.status === 'active' ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={() => removeDraftSubcategory(sub.id)}
                        className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-danger-surface hover:text-danger"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pl-0.5">
                      <Select
                        value={sub.variantKind}
                        onChange={(e) =>
                          setDraftSubcategoryVariantKind(sub.id, e.target.value as SubVariantKind)
                        }
                        className="h-8 shrink-0 basis-40 text-[12px]"
                      >
                        <option value="inherit">Inherit from category</option>
                        <option value="weight_volume">Weight / Volume</option>
                        <option value="attribute">Size / Attribute</option>
                      </Select>

                      {sub.variantKind !== 'inherit' && (
                        <>
                          <Input
                            value={sub.variantLabel}
                            onChange={(e) => setDraftSubcategoryVariantField(sub.id, 'variantLabel', e.target.value)}
                            placeholder="Field label"
                            className="h-8 basis-28 text-[12px]"
                          />
                          <Input
                            value={sub.variantValues}
                            onChange={(e) => setDraftSubcategoryVariantField(sub.id, 'variantValues', e.target.value)}
                            placeholder={sub.variantKind === 'weight_volume' ? 'g, kg, ml, L, pcs' : 'XS, S, M, L, XL'}
                            className="h-8 flex-1 text-[12px]"
                          />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

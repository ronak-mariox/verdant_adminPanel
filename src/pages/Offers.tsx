import { useEffect, useMemo, useState } from 'react';
import { Plus, Tag, Pause, Play, Pencil, Trash2, Calendar, Percent, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Drawer, Modal } from '@/components/ui/Drawer';
import { Field, Input, Label } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { Offer, OfferStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { api, ApiError } from '@/lib/api';

const STATUS_TABS: { value: OfferStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
];

// Only 'percentage' and 'flat' are ever sent to / received from the backend —
// coupons have no "free delivery" discount type server-side, so that option is
// left out of the create/edit form rather than kept as a control that silently
// does nothing when saved.
type EditableOfferType = 'percentage' | 'flat';

const EMPTY_FORM = {
  description: '',
  code: '',
  type: 'percentage' as EditableOfferType,
  value: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  expiresAt: '',
};

function valueLabel(offer: Offer) {
  return offer.type === 'percentage' ? `${offer.value}% OFF` : `${formatCurrency(offer.value)} OFF`;
}

function usageLabel(offer: Offer) {
  const used = offer.usedCount.toLocaleString('en-IN');
  return offer.usageLimit !== undefined ? `${used} / ${offer.usageLimit.toLocaleString('en-IN')}` : `${used} times`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Backend shape (GET/POST/PATCH /admin/coupons)
// ---------------------------------------------------------------------------

interface ApiCoupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'flat' | 'percent';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  expiresAt?: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Maps a real coupon into the admin panel's local Offer shape. Status is derived
// from isActive + whether expiresAt has passed (the backend has no separate start
// date, so no "scheduled" state); startDate is createdAt; endDate stays undefined
// when the coupon never expires.
function mapCoupon(c: ApiCoupon): Offer {
  const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;
  const status: OfferStatus = expired ? 'expired' : c.isActive ? 'active' : 'paused';
  return {
    id: c.id,
    description: c.description ?? '',
    code: c.code,
    type: c.discountType === 'percent' ? 'percentage' : 'flat',
    value: c.value,
    minOrderValue: c.minOrderValue,
    maxDiscount: c.maxDiscount ?? undefined,
    usageLimit: c.usageLimit ?? undefined,
    usedCount: c.usedCount,
    status,
    startDate: c.createdAt,
    endDate: c.expiresAt,
  };
}

export function Offers() {
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusTab, setStatusTab] = useState<OfferStatus | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<ApiCoupon[]>('/admin/coupons');
        if (!cancelled) setCoupons(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load offers'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const offerList = useMemo(() => coupons.map(mapCoupon), [coupons]);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? offerList.length : offerList.filter((o) => o.status === t.value).length,
  }));

  const filtered = useMemo(() => {
    if (statusTab === 'all') return offerList;
    return offerList.filter((o) => o.status === statusTab);
  }, [offerList, statusTab]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function openEdit(offer: Offer) {
    setEditingId(offer.id);
    setForm({
      description: offer.description,
      code: offer.code,
      type: offer.type,
      value: String(offer.value),
      minOrderValue: String(offer.minOrderValue),
      maxDiscount: offer.maxDiscount !== undefined ? String(offer.maxDiscount) : '',
      usageLimit: offer.usageLimit !== undefined ? String(offer.usageLimit) : '',
      expiresAt: offer.endDate ? offer.endDate.slice(0, 10) : '',
    });
    setDrawerError(null);
    setDrawerOpen(true);
  }

  async function toggleStatus(offer: Offer) {
    if (offer.status !== 'active' && offer.status !== 'paused') return;
    setActionError(null);
    try {
      const updated = await api.patch<ApiCoupon>(`/admin/coupons/${offer.id}`, { isActive: offer.status !== 'active' });
      setCoupons((prev) => prev.map((c) => (c.id === offer.id ? updated : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update offer status'));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/admin/coupons/${deleteTarget.id}`);
      setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to delete offer'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!form.code.trim()) {
      setDrawerError('Coupon code is required');
      return;
    }
    if (form.type === 'percentage' && Number(form.value) > 100) {
      setDrawerError('Percentage discount cannot exceed 100');
      return;
    }
    setSaving(true);
    setDrawerError(null);
    try {
      // On edit, blank optional fields are sent as null so a previously set
      // limit/expiry can actually be cleared (the PATCH validator accepts null).
      const optional = (raw: string, parse: (v: string) => number) =>
        raw.trim() ? parse(raw) : editingId ? null : undefined;
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        discountType: form.type === 'percentage' ? ('percent' as const) : ('flat' as const),
        value: Number(form.value) || 0,
        minOrderValue: Number(form.minOrderValue) || 0,
        maxDiscount: optional(form.maxDiscount, Number),
        usageLimit: optional(form.usageLimit, (v) => Math.max(0, Math.floor(Number(v)))),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : editingId ? null : undefined,
      };

      let updated: ApiCoupon;
      if (editingId) {
        updated = await api.patch<ApiCoupon>(`/admin/coupons/${editingId}`, payload);
      } else {
        updated = await api.post<ApiCoupon>('/admin/coupons', payload);
      }

      setCoupons((prev) => (editingId ? prev.map((c) => (c.id === editingId ? updated : c)) : [updated, ...prev]));
      setDrawerOpen(false);
    } catch (err) {
      setDrawerError(errorMessage(err, 'Failed to save offer'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Offers & Promotions"
        subtitle="Create and manage coupon codes and promotional campaigns"
        actions={
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            Create Offer
          </Button>
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="mb-5">
        <Tabs
          items={tabItems}
          value={statusTab}
          onChange={(v) => setStatusTab(v as OfferStatus | 'all')}
        />
      </div>

      {loading ? (
        <Card>
          <EmptyState icon={<Loader2 size={22} className="animate-spin" />} title="Loading offers…" />
        </Card>
      ) : loadError ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Couldn't load offers"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tag size={24} />}
            title="No offers found"
            description="Try a different filter, or create a new offer to get started."
            action={
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Create Offer
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((offer) => (
            <Card key={offer.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    {offer.type === 'percentage' ? <Percent size={18} /> : <Tag size={18} />}
                  </div>
                  <StatusBadge status={offer.status} />
                </div>

                <div>
                  <h3 className="font-display text-[15px] font-semibold text-ink-900">{offer.code}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-500">{offer.description || 'No description'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">
                    {offer.code}
                  </span>
                  <span className="text-sm font-bold text-brand-700">{valueLabel(offer)}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px] text-ink-500">
                  <span>Min order</span>
                  <span className="text-right font-medium text-ink-700">{formatCurrency(offer.minOrderValue)}</span>
                  {offer.maxDiscount !== undefined && (
                    <>
                      <span>Max discount</span>
                      <span className="text-right font-medium text-ink-700">{formatCurrency(offer.maxDiscount)}</span>
                    </>
                  )}
                  <span>Used</span>
                  <span className="text-right font-medium text-ink-700">{usageLabel(offer)}</span>
                </div>

                <div className="mt-auto flex items-center gap-1.5 border-t border-ink-100 pt-3 text-[12px] text-ink-500">
                  <Calendar size={13} />
                  {formatDate(offer.startDate)} – {offer.endDate ? formatDate(offer.endDate) : 'No expiry'}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {(offer.status === 'active' || offer.status === 'paused') && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={offer.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      onClick={() => toggleStatus(offer)}
                      className="flex-1"
                    >
                      {offer.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Pencil size={14} />}
                    onClick={() => openEdit(offer)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={14} />}
                    onClick={() => setDeleteTarget(offer)}
                    aria-label="Delete offer"
                    className="text-danger hover:bg-danger-surface"
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit Offer' : 'Create Offer'}
        subtitle={editingId ? 'Update the promotion details' : 'Set up a new coupon or promotional campaign'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.code.trim() || saving} loading={saving}>
              {editingId ? 'Save changes' : 'Create offer'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {drawerError && <InlineAlert message={drawerError} />}

          <Field label="Description" hint="Shown to customers as the offer summary">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Flat 25% off on your first order"
            />
          </Field>
          <Field label="Coupon code">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="WELCOME25"
              className="font-mono uppercase"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as EditableOfferType })}
                className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount</option>
              </select>
            </div>
            <Field label="Value" hint={form.type === 'percentage' ? 'In %' : 'In ₹'}>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="25"
              />
            </Field>
          </div>
          <Field label="Minimum order value (₹)">
            <Input
              type="number"
              value={form.minOrderValue}
              onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
              placeholder="199"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max discount (₹)" hint="Caps a percentage discount; blank = no cap">
              <Input
                type="number"
                min={0}
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                placeholder="100"
              />
            </Field>
            <Field label="Usage limit" hint="Total redemptions allowed; blank = unlimited">
              <Input
                type="number"
                min={0}
                step={1}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="500"
              />
            </Field>
          </div>
          <Field label="Expiry date" hint="Leave blank for no expiry">
            <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
        </div>
      </Drawer>

      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete offer"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Delete coupon <span className="font-mono font-semibold text-ink-800">{deleteTarget?.code}</span>? Customers will no
          longer be able to apply it. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

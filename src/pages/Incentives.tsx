import { useEffect, useMemo, useState } from 'react';
import { Plus, Gift, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Drawer, Modal } from '@/components/ui/Drawer';
import { Field, Input, Select } from '@/components/ui/Input';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { formatCurrency, formatDate } from '@/lib/format';
import { api, ApiError, unwrapList } from '@/lib/api';

type IncentiveStatus = 'active' | 'expired';

interface ApiIncentive {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  targetDeliveries: number;
  startAt: string;
  expiresAt: string;
  status: IncentiveStatus;
  conditions: { label: string; type: string; threshold: number }[];
  createdAt: string;
}

const STATUS_TABS: { value: IncentiveStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
];

const EMPTY_FORM = {
  title: '',
  description: '',
  rewardAmount: '',
  targetDeliveries: '',
  startAt: '',
  expiresAt: '',
  status: 'active' as IncentiveStatus,
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function Incentives() {
  const [incentives, setIncentives] = useState<ApiIncentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusTab, setStatusTab] = useState<IncentiveStatus | 'all'>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiIncentive | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<ApiIncentive[] | { items: ApiIncentive[] }>('/admin/incentives');
        if (!cancelled) setIncentives(unwrapList(data));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load incentives'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? incentives.length : incentives.filter((i) => i.status === t.value).length,
  }));

  const filtered = useMemo(
    () => (statusTab === 'all' ? incentives : incentives.filter((i) => i.status === statusTab)),
    [incentives, statusTab],
  );

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function openEdit(i: ApiIncentive) {
    setEditingId(i.id);
    setForm({
      title: i.title,
      description: i.description,
      rewardAmount: String(i.rewardAmount),
      targetDeliveries: String(i.targetDeliveries),
      startAt: toDateInput(i.startAt),
      expiresAt: toDateInput(i.expiresAt),
      status: i.status,
    });
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required';
    if (!form.description.trim()) return 'Description is required';
    if (!(Number(form.rewardAmount) > 0)) return 'Reward amount must be greater than 0';
    if (!(Number.isInteger(Number(form.targetDeliveries)) && Number(form.targetDeliveries) >= 1)) {
      return 'Target deliveries must be a whole number of at least 1';
    }
    if (!form.startAt || !form.expiresAt) return 'Start and expiry dates are required';
    if (form.expiresAt < form.startAt) return 'Expiry date must be on or after the start date';
    return null;
  }

  async function handleSave() {
    const invalid = validate();
    if (invalid) {
      setDrawerError(invalid);
      return;
    }
    setSaving(true);
    setDrawerError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        rewardAmount: Number(form.rewardAmount),
        targetDeliveries: Number(form.targetDeliveries),
        startAt: new Date(`${form.startAt}T00:00:00`).toISOString(),
        expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString(),
        status: form.status,
      };
      if (editingId) {
        const updated = await api.patch<ApiIncentive>(`/admin/incentives/${editingId}`, payload);
        setIncentives((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await api.post<ApiIncentive>('/admin/incentives', payload);
        setIncentives((prev) => [created, ...prev]);
      }
      setDrawerOpen(false);
    } catch (err) {
      setDrawerError(errorMessage(err, 'Failed to save incentive'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/admin/incentives/${deleteTarget.id}`);
      setIncentives((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to delete incentive'));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Driver Incentives"
        subtitle="Delivery-target bonuses offered to drivers"
        actions={
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            New Incentive
          </Button>
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="mb-5">
        <Tabs items={tabItems} value={statusTab} onChange={(v) => setStatusTab(v as IncentiveStatus | 'all')} />
      </div>

      <Card>
        {loading ? (
          <EmptyState icon={<Loader2 size={22} className="animate-spin" />} title="Loading incentives…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Couldn't load incentives"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Gift size={24} />}
            title="No incentives found"
            description="Create an incentive to reward drivers for hitting delivery targets."
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Incentive</Th>
                <Th className="text-right">Reward</Th>
                <Th className="text-right">Target deliveries</Th>
                <Th>Window</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <tbody>
              {filtered.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <p className="font-medium text-ink-900">{i.title}</p>
                    <p className="text-[12.5px] text-ink-500">{i.description}</p>
                    {i.conditions.length > 0 && (
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        {i.conditions.map((c) => `${c.label} (${c.threshold})`).join(' · ')}
                      </p>
                    )}
                  </Td>
                  <Td className="text-right font-semibold text-ink-900">{formatCurrency(i.rewardAmount)}</Td>
                  <Td className="text-right">{i.targetDeliveries.toLocaleString('en-IN')}</Td>
                  <Td className="whitespace-nowrap text-[13px] text-ink-600">
                    {formatDate(i.startAt)} – {formatDate(i.expiresAt)}
                  </Td>
                  <Td>
                    <StatusBadge status={i.status} />
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(i)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={14} />}
                        onClick={() => setDeleteTarget(i)}
                        aria-label="Delete incentive"
                        className="text-danger hover:bg-danger-surface"
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit Incentive' : 'New Incentive'}
        subtitle="Drivers earn the reward once they complete the target number of deliveries within the window"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? 'Save changes' : 'Create incentive'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {drawerError && <InlineAlert message={drawerError} />}
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Reward (₹)">
              <Input
                type="number"
                min={0}
                value={form.rewardAmount}
                onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
              />
            </Field>
            <Field label="Target deliveries">
              <Input
                type="number"
                min={1}
                step={1}
                value={form.targetDeliveries}
                onChange={(e) => setForm({ ...form, targetDeliveries: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <Input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </Field>
            <Field label="Expires">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IncentiveStatus })}>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
        </div>
      </Drawer>

      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete incentive"
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
          Delete <span className="font-semibold text-ink-800">{deleteTarget?.title}</span>? Drivers will no longer see it.
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

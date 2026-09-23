import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Drawer';
import { Field } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { api } from '@/lib/api';
import { vendorDisplayName, errorMessage, type ApiVendor as ApiVendorBase } from '@/lib/adminOrders';
import type { BankDetailsFields, PendingBankDetails } from '@/types';
import { formatDate } from '@/lib/format';

interface ApiVendorWithBankRequest extends ApiVendorBase {
  bankDetails?: BankDetailsFields;
  pendingBankDetails?: PendingBankDetails;
}

const BANK_FIELD_ROWS: { key: keyof BankDetailsFields; label: string }[] = [
  { key: 'accountHolderName', label: 'Account holder' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'bankName', label: 'Bank' },
  { key: 'branch', label: 'Branch' },
  { key: 'accountType', label: 'Account type' },
  { key: 'upiId', label: 'UPI ID' },
];

export function BankDetailsRequests() {
  const [vendors, setVendors] = useState<ApiVendorWithBankRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);
  const [rejectVendorId, setRejectVendorId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<ApiVendorWithBankRequest[]>('/admin/bank-requests');
        if (!cancelled) setVendors(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load bank details requests'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function review(vendorId: string, approve: boolean, note?: string) {
    setActionError(null);
    setBusyVendorId(vendorId);
    try {
      await api.patch(`/admin/bank-requests/${vendorId}`, { approve, note });
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
      setRejectVendorId(null);
      setRejectNote('');
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to review bank details request'));
    } finally {
      setBusyVendorId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bank Details Requests"
        subtitle="Vendors can't change their live bank details directly — review each change request before it applies"
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <Card>
        <CardHeader title="Pending requests" subtitle={`${vendors.length} awaiting review`} />

        {loading ? (
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading requests…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load requests"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : vendors.length === 0 ? (
          <EmptyState icon={<Landmark size={24} />} title="No pending requests" description="Every bank details change request has been reviewed." />
        ) : (
          <div className="divide-y divide-ink-100">
            {vendors.map((v) => {
              const pending = v.pendingBankDetails;
              if (!pending) return null;
              const busy = busyVendorId === v.id;
              return (
                <div key={v.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link to={`/vendors/${v.id}`} className="text-sm font-semibold text-ink-800 hover:text-brand-700">
                        {vendorDisplayName(v)}
                      </Link>
                      <p className="text-xs text-ink-400">Submitted {formatDate(pending.submittedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle2 size={16} />}
                        disabled={busy}
                        onClick={() => review(v.id, true)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle size={16} />}
                        disabled={busy}
                        onClick={() => {
                          setRejectVendorId(v.id);
                          setRejectNote('');
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Current on file</p>
                      <dl className="space-y-1 text-[13px]">
                        {BANK_FIELD_ROWS.map((row) => (
                          <div key={row.key} className="flex justify-between gap-3">
                            <dt className="text-ink-400">{row.label}</dt>
                            <dd className="text-ink-700">{v.bankDetails?.[row.key] || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Requested change</p>
                      <dl className="space-y-1 text-[13px]">
                        {BANK_FIELD_ROWS.map((row) => {
                          const oldVal = v.bankDetails?.[row.key] || '';
                          const newVal = pending.data[row.key] || '—';
                          const changed = newVal !== '—' && newVal !== oldVal;
                          return (
                            <div key={row.key} className="flex justify-between gap-3">
                              <dt className="text-ink-400">{row.label}</dt>
                              <dd className={changed ? 'font-semibold text-brand-700' : 'text-ink-700'}>{newVal}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={rejectVendorId !== null}
        onClose={() => setRejectVendorId(null)}
        title="Reject bank details request"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectVendorId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectNote.trim() || busyVendorId !== null}
              onClick={() => rejectVendorId && review(rejectVendorId, false, rejectNote.trim())}
            >
              Reject request
            </Button>
          </>
        }
      >
        <Field label="Reason for rejection" hint="Shown to the vendor so they know what to fix.">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            placeholder="e.g. IFSC code doesn't match the bank name provided"
            className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
      </Modal>
    </div>
  );
}

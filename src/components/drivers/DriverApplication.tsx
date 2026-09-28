import { useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ExternalLink, FileText, ImageOff, RotateCcw, X, XCircle, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Drawer';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { resolveAssetUrl } from '@/lib/asset';
import { formatDate } from '@/lib/format';

export type DriverReviewKey =
  | 'profile_photo'
  | 'license_front'
  | 'license_back'
  | 'rc'
  | 'insurance'
  | 'personal_info'
  | 'vehicle_details'
  | 'insurance_details'
  | 'bank_details';

export interface DriverItemReview {
  status: 'verified' | 'rejected';
  note?: string;
  reviewedAt?: string;
}

export type DriverReviews = Partial<Record<DriverReviewKey, DriverItemReview>>;

const REVIEW_KEYS: DriverReviewKey[] = [
  'profile_photo',
  'license_front',
  'license_back',
  'rc',
  'insurance',
  'personal_info',
  'vehicle_details',
  'insurance_details',
  'bank_details',
];

export function reviewCounts(reviews: DriverReviews | undefined) {
  const verified = REVIEW_KEYS.filter((key) => reviews?.[key]?.status === 'verified').length;
  const rejected = REVIEW_KEYS.filter((key) => reviews?.[key]?.status === 'rejected').length;
  return { total: REVIEW_KEYS.length, verified, rejected, pending: REVIEW_KEYS.length - verified - rejected };
}

export interface DriverApplicationData {
  phone: string;
  fullName?: string;
  email?: string;
  dob?: string;
  gender?: string;
  avatarUrl?: string;
  referenceId?: string;
  address?: {
    line1?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    addressType?: string;
  };
  emergencyContact?: { name?: string; relationship?: string; mobile?: string; altMobile?: string };
  vehicleType?: string;
  vehicleDetails?: {
    registrationNumber?: string;
    brand?: string;
    model?: string;
    year?: number;
    fuelType?: string;
    color?: string;
    capacity?: string;
  };
  documents?: Partial<Record<'license_front' | 'license_back' | 'rc' | 'insurance', string>>;
  insuranceDetails?: { insuranceType?: string; policyNumber?: string; validFrom?: string; validUntil?: string };
  bankDetails?: { accountHolderName?: string; accountNumber?: string; ifsc?: string; upiId?: string };
  reviews?: DriverReviews;
}

interface DocumentSlot {
  reviewKey: DriverReviewKey;
  label: string;
  url?: string;
  required: boolean;
}

interface ReviewControlsProps {
  review?: DriverItemReview;
  busy: boolean;
  onVerify: () => void;
  onReject: () => void;
  onReset: () => void;
}

function ReviewControls({ review, busy, onVerify, onReject, onReset }: ReviewControlsProps) {
  if (review) {
    const verified = review.status === 'verified';
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            verified ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger'
          }`}
        >
          {verified ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {verified ? 'Verified' : 'Rejected'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          title="Undo — mark as not reviewed"
          className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-40"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={onVerify}
        className="inline-flex items-center gap-1 rounded-md bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/20 disabled:opacity-40"
      >
        <Check size={12} /> Verify
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="inline-flex items-center gap-1 rounded-md bg-danger-surface px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/20 disabled:opacity-40"
      >
        <X size={12} /> Reject
      </button>
    </div>
  );
}

const isPdfUrl = (url: string) => /\.pdf($|\?)/i.test(url);

function ageFrom(dob: string): number | null {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  const hadBirthday =
    now.getMonth() > born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  return now.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1);
}

function isPast(date?: string): boolean {
  if (!date) return false;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < Date.now();
}

const titleCase = (value?: string) =>
  value ? value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';

function Section({
  title,
  children,
  controls,
  note,
}: {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
        {controls}
      </div>
      {note && <p className="mb-3 rounded-lg bg-danger-surface px-3 py-2 text-[12.5px] text-danger">Rejected: {note}</p>}
      {children}
    </div>
  );
}

function Field({ label, value, flag }: { label: string; value?: ReactNode; flag?: ReactNode }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-ink-500">{label}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <p className={`break-words text-[13.5px] font-medium ${empty ? 'text-ink-400' : 'text-ink-800'}`}>
          {empty ? 'Not provided' : value}
        </p>
        {flag}
      </div>
    </div>
  );
}

function Flag({ tone, children }: { tone: 'danger' | 'warning'; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === 'danger' ? 'bg-danger-surface text-danger' : 'bg-warning-surface text-warning'
      }`}
    >
      {children}
    </span>
  );
}

interface Props {
  driver: DriverApplicationData;
  /** Omit to render the application read-only (e.g. registration still in progress). */
  onReview?: (key: DriverReviewKey, status: 'pending' | 'verified' | 'rejected', note?: string) => Promise<void>;
}

export function DriverApplication({ driver, onReview }: Props) {
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [busyKey, setBusyKey] = useState<DriverReviewKey | 'all' | null>(null);
  const [rejecting, setRejecting] = useState<{ key: DriverReviewKey; label: string } | null>(null);

  const reviews = driver.reviews ?? {};
  const counts = reviewCounts(reviews);

  async function review(key: DriverReviewKey, status: 'pending' | 'verified' | 'rejected', note?: string) {
    if (!onReview) return;
    setBusyKey(key);
    try {
      await onReview(key, status, note);
      setRejecting(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function verifyRemaining() {
    if (!onReview) return;
    setBusyKey('all');
    try {
      for (const key of REVIEW_KEYS) {
        if (!reviews[key]) await onReview(key, 'verified');
      }
    } finally {
      setBusyKey(null);
    }
  }

  const controlsFor = (key: DriverReviewKey, label: string) =>
    onReview ? (
      <ReviewControls
        review={reviews[key]}
        busy={busyKey !== null}
        onVerify={() => review(key, 'verified')}
        onReject={() => setRejecting({ key, label })}
        onReset={() => review(key, 'pending')}
      />
    ) : undefined;

  const rejectedNote = (key: DriverReviewKey) =>
    reviews[key]?.status === 'rejected' ? reviews[key]?.note || 'No reason given' : undefined;

  const documents: DocumentSlot[] = [
    { reviewKey: 'profile_photo', label: 'Profile photo', url: driver.avatarUrl, required: false },
    { reviewKey: 'license_front', label: 'Driving licence — front', url: driver.documents?.license_front, required: true },
    { reviewKey: 'license_back', label: 'Driving licence — back', url: driver.documents?.license_back, required: true },
    { reviewKey: 'rc', label: 'Vehicle RC', url: driver.documents?.rc, required: true },
    { reviewKey: 'insurance', label: 'Insurance', url: driver.documents?.insurance, required: true },
  ];
  const missing = documents.filter((doc) => doc.required && !doc.url);

  const age = driver.dob ? ageFrom(driver.dob) : null;
  const address = driver.address;
  const addressLine = [address?.line1, address?.area, address?.city, address?.state, address?.pincode]
    .filter(Boolean)
    .join(', ');
  const vehicle = driver.vehicleDetails;
  const insurance = driver.insuranceDetails;
  const insuranceExpired = isPast(insurance?.validUntil);

  return (
    <div className="space-y-4 p-4">
      {onReview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-ink-800">
              {counts.verified} of {counts.total} items verified
              {counts.rejected > 0 && <span className="text-danger"> · {counts.rejected} rejected</span>}
              {counts.pending > 0 && <span className="font-normal text-ink-500"> · {counts.pending} to review</span>}
            </p>
            <p className="text-[12px] text-ink-500">
              Check each document and section. Rejected items are sent back to the driver with your reason.
            </p>
          </div>
          {counts.pending > 0 && (
            <Button variant="outline" icon={<Check size={14} />} onClick={verifyRemaining} loading={busyKey === 'all'}>
              Verify all remaining
            </Button>
          )}
        </div>
      )}

      <Section title="Documents">
        {missing.length > 0 && (
          <p className="mb-3 rounded-lg bg-warning-surface px-3 py-2 text-[13px] text-warning">
            Missing: {missing.map((doc) => doc.label).join(', ')}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {documents.map((doc) => {
            const url = doc.url ? resolveAssetUrl(doc.url) : '';
            return (
              <div key={doc.label} className="min-w-0">
                {url ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ url, label: doc.label })}
                    className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-ink-200 bg-ink-50"
                    title={`View ${doc.label}`}
                  >
                    {isPdfUrl(url) ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400">
                        <FileText size={24} />
                        <span className="text-[11px] font-medium">PDF</span>
                      </span>
                    ) : (
                      <img src={url} alt={doc.label} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-white opacity-0 transition group-hover:bg-ink-900/40 group-hover:opacity-100">
                      <ZoomIn size={20} />
                    </span>
                  </button>
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 bg-ink-50 text-ink-400">
                    <ImageOff size={20} />
                    <span className="text-[11px] font-medium">Not uploaded</span>
                  </div>
                )}
                <p className="mt-1.5 truncate text-[12px] font-medium text-ink-700" title={doc.label}>
                  {doc.label}
                </p>
                {url && <div className="mt-1">{controlsFor(doc.reviewKey, doc.label)}</div>}
                {rejectedNote(doc.reviewKey) && (
                  <p className="mt-1 text-[11.5px] leading-snug text-danger">{rejectedNote(doc.reviewKey)}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Personal details"
          controls={controlsFor('personal_info', 'Personal details')}
          note={rejectedNote('personal_info')}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Full name" value={driver.fullName} />
            <Field label="Mobile" value={driver.phone} />
            <Field label="Email" value={driver.email} />
            <Field label="Gender" value={titleCase(driver.gender)} />
            <Field
              label="Date of birth"
              value={driver.dob ? `${formatDate(driver.dob)}${age !== null ? ` · ${age} yrs` : ''}` : undefined}
              flag={age !== null && age < 18 ? <Flag tone="danger">Under 18</Flag> : undefined}
            />
            <Field label="Application ID" value={driver.referenceId} />
          </div>
        </Section>

        <Section title="Address">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <Field label="Address" value={addressLine} />
            </div>
            <Field label="Type" value={titleCase(address?.addressType)} />
            <Field label="Pincode" value={address?.pincode} />
          </div>
        </Section>

        <Section
          title="Vehicle"
          controls={controlsFor('vehicle_details', 'Vehicle details')}
          note={rejectedNote('vehicle_details')}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Vehicle type" value={titleCase(driver.vehicleType)} />
            <Field label="Registration number" value={vehicle?.registrationNumber} />
            <Field label="Make & model" value={[vehicle?.brand, vehicle?.model].filter(Boolean).join(' ')} />
            <Field label="Year" value={vehicle?.year} />
            <Field label="Fuel" value={vehicle?.fuelType} />
            <Field
              label="Colour"
              value={
                vehicle?.color ? (
                  <span className="inline-flex items-center gap-1.5">
                    {/^#[0-9a-f]{3,8}$/i.test(vehicle.color) && (
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-ink-200"
                        style={{ backgroundColor: vehicle.color }}
                      />
                    )}
                    {vehicle.color}
                  </span>
                ) : undefined
              }
            />
          </div>
        </Section>

        <Section
          title="Insurance"
          controls={controlsFor('insurance_details', 'Insurance details')}
          note={rejectedNote('insurance_details')}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Type" value={titleCase(insurance?.insuranceType)} />
            <Field label="Policy number" value={insurance?.policyNumber} />
            <Field label="Valid from" value={insurance?.validFrom ? formatDate(insurance.validFrom) : undefined} />
            <Field
              label="Valid until"
              value={insurance?.validUntil ? formatDate(insurance.validUntil) : undefined}
              flag={insuranceExpired ? <Flag tone="danger">Expired</Flag> : undefined}
            />
          </div>
        </Section>

        <Section title="Emergency contact">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Name" value={driver.emergencyContact?.name} />
            <Field label="Relationship" value={titleCase(driver.emergencyContact?.relationship)} />
            <Field label="Mobile" value={driver.emergencyContact?.mobile} />
            <Field label="Alternate mobile" value={driver.emergencyContact?.altMobile} />
          </div>
        </Section>

        <Section
          title="Bank details"
          controls={controlsFor('bank_details', 'Bank details')}
          note={rejectedNote('bank_details')}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Account holder" value={driver.bankDetails?.accountHolderName} />
            <Field label="Account number" value={driver.bankDetails?.accountNumber} />
            <Field label="IFSC" value={driver.bankDetails?.ifsc} />
            <Field label="UPI ID" value={driver.bankDetails?.upiId} />
          </div>
        </Section>
      </div>

      <ReasonModal
        open={rejecting !== null}
        title={`Reject ${rejecting?.label ?? 'item'}?`}
        label="Reason"
        hint="Shown to the driver so they know exactly what to fix."
        placeholder="e.g. Photo is blurry, licence number isn't readable"
        confirmLabel="Reject item"
        busy={busyKey !== null}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => (rejecting ? review(rejecting.key, 'rejected', reason) : undefined)}
      />

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.label ?? 'Document'} width={720}>
        {preview &&
          (isPdfUrl(preview.url) ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileText size={32} className="text-ink-300" />
              <p className="text-sm text-ink-600">This document is a PDF and can't be previewed inline.</p>
            </div>
          ) : (
            <img src={preview.url} alt={preview.label} className="max-h-[70vh] w-full rounded-xl object-contain" />
          ))}
        {preview && (
          <div className="mt-4 flex justify-end">
            <a href={preview.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" icon={<ExternalLink size={14} />}>
                Open original
              </Button>
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Modal } from './Drawer';
import { Button } from './Button';
import { Field } from './Input';
import { InlineAlert } from './InlineAlert';

/** Collects a free-text reason before a destructive/negative action (reject, cancel…). */
export function ReasonModal({
  open,
  title,
  description,
  label = 'Reason',
  hint,
  placeholder,
  confirmLabel = 'Confirm',
  required = true,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  confirmLabel?: string;
  required?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" disabled={(required && !trimmed) || busy} loading={busy} onClick={() => onConfirm(trimmed)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {description && <p className="text-sm text-ink-600">{description}</p>}
        {error && <InlineAlert message={error} />}
        <Field label={required ? label : `${label} (optional)`} hint={hint}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
      </div>
    </Modal>
  );
}

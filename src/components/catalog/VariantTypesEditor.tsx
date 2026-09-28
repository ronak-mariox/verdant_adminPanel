import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { KIND_DEFAULTS, newVariantType, splitValues, type DraftVariantType } from '@/lib/variantTypes';
import type { VariantKind } from '@/types';

const KIND_PLACEHOLDERS: Record<VariantKind, string> = {
  weight_volume: 'g, kg, ml, L, pcs',
  attribute: 'e.g. Black, White, Blue  or  32GB, 64GB',
  none: '',
};

interface Props {
  types: DraftVariantType[];
  onChange: (types: DraftVariantType[]) => void;
  /** Category level must keep at least one type; subcategories may be emptied via "inherit". */
  minTypes?: number;
  compact?: boolean;
}

export function VariantTypesEditor({ types, onChange, minTypes = 1, compact }: Props) {
  const update = (key: string, patch: Partial<DraftVariantType>) =>
    onChange(types.map((type) => (type.key === key ? { ...type, ...patch } : type)));

  const inputSize = compact ? 'h-8 text-[12px]' : '';

  return (
    <div className="space-y-2.5">
      {types.map((type, index) => (
        <div key={type.key} className="space-y-2 rounded-lg border border-ink-200 bg-ink-50/50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">
              {index === 0 ? 'DEFAULT' : `OPTION ${index + 1}`}
            </span>
            <Select
              value={type.kind}
              onChange={(e) => {
                const kind = e.target.value as VariantKind;
                update(type.key, { kind, ...KIND_DEFAULTS[kind], allowCustom: false });
              }}
              className={`flex-1 ${inputSize}`}
            >
              <option value="weight_volume">Weight / Volume — grocery, liquids</option>
              <option value="attribute">Options — size, colour, storage…</option>
              <option value="none">No variants — sold as a single item</option>
            </Select>
            <button
              type="button"
              onClick={() => onChange(types.filter((item) => item.key !== type.key))}
              disabled={types.length <= minTypes}
              className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-danger-surface hover:text-danger disabled:pointer-events-none disabled:opacity-30"
              title="Remove variant type"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {type.kind === 'none' ? (
            <p className="text-[12px] text-ink-500">
              Vendors enter just one price and stock — no size, unit or colour. Use for earbuds, chargers, watches…
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={type.label}
                  onChange={(e) => update(type.key, { label: e.target.value })}
                  placeholder="Label, e.g. Colour"
                  className={`basis-36 ${inputSize}`}
                />
                <Input
                  value={type.values}
                  onChange={(e) => update(type.key, { values: e.target.value })}
                  placeholder={KIND_PLACEHOLDERS[type.kind]}
                  className={`flex-1 ${inputSize}`}
                />
              </div>

              {splitValues(type.values).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {splitValues(type.values).map((value) => (
                    <span
                      key={value}
                      className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-700"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              )}

              {type.kind === 'attribute' && (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-600">
                  <input
                    type="checkbox"
                    checked={type.allowCustom}
                    onChange={(e) => update(type.key, { allowCustom: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-ink-300 accent-brand-600"
                  />
                  Let vendors type their own value if it isn't in this list
                </label>
              )}
            </>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        icon={<Plus size={14} />}
        onClick={() => onChange([...types, newVariantType(types.length === 0 ? 'weight_volume' : 'attribute')])}
      >
        Add variant type
      </Button>
    </div>
  );
}

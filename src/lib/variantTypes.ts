import type { CategoryVariantConfig, VariantKind } from '@/types';

export interface DraftVariantType {
  key: string;
  kind: VariantKind;
  label: string;
  values: string;
  allowCustom: boolean;
}

export const KIND_DEFAULTS: Record<VariantKind, { label: string; values: string }> = {
  weight_volume: { label: 'Weight/Volume', values: 'g, kg, ml, L, pcs' },
  attribute: { label: 'Size', values: 'S, M, L, XL' },
  none: { label: 'No variants', values: '' },
};

let keyCounter = 0;
const nextKey = () => `vt-${Date.now()}-${keyCounter++}`;

export function newVariantType(kind: VariantKind = 'weight_volume'): DraftVariantType {
  return { key: nextKey(), kind, ...KIND_DEFAULTS[kind], allowCustom: false };
}

export const splitValues = (values: string) => [
  ...new Set(
    values
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

export function toDraftVariantTypes(
  configs: CategoryVariantConfig[] | undefined,
  legacy: CategoryVariantConfig | undefined,
): DraftVariantType[] {
  const list = configs?.length ? configs : legacy ? [legacy] : [];
  return list.map((config) => ({
    key: nextKey(),
    kind: config.kind,
    label: config.label,
    values: ((config.kind === 'attribute' ? config.options : config.units) ?? []).join(', '),
    allowCustom: config.allowCustom === true,
  }));
}

export function toVariantConfigs(types: DraftVariantType[]): CategoryVariantConfig[] {
  return types.map((type) => {
    const label = type.label.trim() || KIND_DEFAULTS[type.kind].label;
    if (type.kind === 'weight_volume') return { kind: type.kind, label, units: splitValues(type.values) };
    if (type.kind === 'attribute') {
      return { kind: type.kind, label, options: splitValues(type.values), allowCustom: type.allowCustom };
    }
    return { kind: type.kind, label };
  });
}

/** Returns a message describing the first problem, or null when the list can be saved. */
export function validateVariantTypes(types: DraftVariantType[]): string | null {
  const labels = types.map((type) => (type.label.trim() || KIND_DEFAULTS[type.kind].label).toLowerCase());
  if (new Set(labels).size !== labels.length) return 'Each variant type needs a different label.';
  for (const type of types) {
    const values = splitValues(type.values);
    if (type.kind === 'weight_volume' && values.length === 0) return `Add at least one unit for "${type.label}".`;
    if (type.kind === 'attribute' && values.length === 0 && !type.allowCustom) {
      return `Add at least one option for "${type.label}", or let vendors enter their own.`;
    }
  }
  return null;
}

export function describeVariantConfigs(configs: CategoryVariantConfig[]): string {
  return configs.map((config) => (config.kind === 'none' ? 'Single item' : config.label)).join(' · ');
}

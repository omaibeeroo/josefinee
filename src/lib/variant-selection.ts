export type VariantSelectionOption = {
  name: string;
  values: ReadonlyArray<{ id: string }>;
};

export type VariantSelectionVariant = {
  id: string;
  available: number;
  optionValueIds: ReadonlyArray<string>;
};

function selectionForVariant(
  options: ReadonlyArray<VariantSelectionOption>,
  variant: VariantSelectionVariant,
): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [
      option.name,
      option.values.find((value) => variant.optionValueIds.includes(value.id))?.id ?? "",
    ]),
  );
}

export function resolveVariantSelection(
  options: ReadonlyArray<VariantSelectionOption>,
  variants: ReadonlyArray<VariantSelectionVariant>,
  current: Readonly<Record<string, string>>,
  optionName: string,
  valueId: string,
): { variantId: string | null; selection: Record<string, string> } {
  const compatible = variants.filter(
    (variant) =>
      variant.optionValueIds.includes(valueId) &&
      options.every(
        (option) =>
          option.name === optionName ||
          !current[option.name] ||
          variant.optionValueIds.includes(current[option.name]!),
      ),
  );
  const chosen =
    compatible.find((variant) => variant.available > 0) ??
    variants.find((variant) => variant.available > 0 && variant.optionValueIds.includes(valueId));
  if (!chosen) {
    return { variantId: null, selection: { ...current, [optionName]: valueId } };
  }
  return { variantId: chosen.id, selection: selectionForVariant(options, chosen) };
}

export function isOptionValueAvailable(
  variants: ReadonlyArray<VariantSelectionVariant>,
  valueId: string,
): boolean {
  return variants.some((variant) => variant.available > 0 && variant.optionValueIds.includes(valueId));
}

export function isOptionValueAvailableForSelection(
  options: ReadonlyArray<VariantSelectionOption>,
  variants: ReadonlyArray<VariantSelectionVariant>,
  current: Readonly<Record<string, string>>,
  optionName: string,
  valueId: string,
): boolean {
  return variants.some(
    (variant) =>
      variant.available > 0 &&
      variant.optionValueIds.includes(valueId) &&
      options.every(
        (option) =>
          option.name === optionName ||
          !current[option.name] ||
          variant.optionValueIds.includes(current[option.name]!),
      ),
  );
}

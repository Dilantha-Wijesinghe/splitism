const currencyFractionDigits = new Map<string, number>([
  ["BHD", 3],
  ["JOD", 3],
  ["JPY", 0],
  ["KWD", 3],
  ["LKR", 2],
  ["USD", 2]
]);

export function getFractionDigits(currency: string) {
  return currencyFractionDigits.get(currency.toUpperCase()) ?? 2;
}

export function parseMoneyToMinor(value: string, currency: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fractionDigits = getFractionDigits(currency);
  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > fractionDigits) {
    return null;
  }

  const paddedFraction = fraction.padEnd(fractionDigits, "0");
  const minor =
    Number.parseInt(whole, 10) * 10 ** fractionDigits +
    Number.parseInt(paddedFraction || "0", 10);

  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function formatMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: getFractionDigits(currency),
    minimumFractionDigits: getFractionDigits(currency)
  }).format(amountMinor / 10 ** getFractionDigits(currency));
}

export function minorToInput(amountMinor: number, currency: string) {
  return (amountMinor / 10 ** getFractionDigits(currency)).toFixed(
    getFractionDigits(currency)
  );
}

export function formatInt(value) {
  return new Intl.NumberFormat("en").format(Math.round(Number(value) || 0));
}

export function formatPct(value, digits = 1) {
  const numeric = Number(value) || 0;
  return `${numeric.toFixed(digits)}%`;
}

export function formatCompact(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

export function formatDecimal(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return numeric.toFixed(digits);
}

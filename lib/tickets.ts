export function normalizeTicketPrefix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function formatTicketNumber(prefix: string, serialNumber: number) {
  return `MT${prefix}${String(serialNumber).padStart(5, "0")}`;
}

export function fallbackTicketPrefixFromSlug(slug: string) {
  const cleaned = slug
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("");

  return (cleaned || "MT").slice(0, 4);
}

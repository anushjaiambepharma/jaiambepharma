/**
 * Splits a requested quantity across a material's available batches,
 * earliest-expiry first (First-Expire-First-Out), so an order never draws
 * down later-expiring stock while earlier stock is still on the shelf.
 * Each split must still land on an exact multiple of the material's pack
 * size, since frmGenericOrder.aspx's own Validation() rejects any cart row
 * whose qty isn't a full-pack quantity.
 */
function parseExpiry(monYear) {
  // "Dec-2027" -> sortable Date. Batches with unparseable expiry sort last.
  const parsed = new Date(`01-${monYear}`);
  return Number.isNaN(parsed.getTime()) ? Infinity : parsed.getTime();
}

export function allocateBatchesFefo(batches, requestedQty, packSize) {
  if (packSize > 0 && requestedQty % packSize !== 0) {
    throw new Error(`Quantity ${requestedQty} is not a multiple of the pack size (${packSize}).`);
  }

  const sorted = [...batches]
    .filter((b) => b.stockQty > 0)
    .sort((a, b) => parseExpiry(a.expiry) - parseExpiry(b.expiry));

  const allocations = [];
  let remaining = requestedQty;
  for (const batch of sorted) {
    if (remaining <= 0) break;
    let take = Math.min(remaining, batch.stockQty);
    if (packSize > 0) take = Math.floor(take / packSize) * packSize;
    if (take <= 0) continue;
    allocations.push({ batch: batch.batch, qty: take, expiry: batch.expiry });
    remaining -= take;
  }

  if (remaining > 0) {
    const totalStock = sorted.reduce((sum, b) => sum + b.stockQty, 0);
    throw new Error(`Not enough stock to cover qty ${requestedQty} (available across batches: ${totalStock}).`);
  }

  return allocations;
}

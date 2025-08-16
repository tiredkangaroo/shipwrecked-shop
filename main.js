import { createHash } from "crypto";

function createHourlyRandom(userId, itemId) {
  const hour = Math.floor(Date.now() / (1000 * 60 * 60));

  // Create a combined seed string
  const combined = `${userId}-${itemId}-${hour}`;

  // Use SHA256 for a high-quality hash
  // We could use crypto.subtle.digest without importing Node.js 'crypto', but that's async
  const hash = createHash("sha256").update(combined).digest("hex");

  // Convert the first 8 characters of the hash (32 bits) to a number between 0 and 1
  const subHash = hash.substring(0, 8);
  const intHash = parseInt(subHash, 16);
  return intHash / 0xffffffff;
}

export function calculateRandomizedPrice(
  userId,
  itemId,
  basePrice,
  minPercent = 90,
  maxPercent = 110
) {
  // Get current hour for this user (deterministic per hour)
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));

  // Create high-quality deterministic random number for this user/item/hour combination
  const random = createHourlyRandom(userId, itemId, currentHour);

  // Ensure we're working with valid percentages
  const safeMinPercent = Math.max(1, minPercent);
  const safeMaxPercent = Math.max(safeMinPercent + 1, maxPercent);

  // Calculate price bounds from percentages
  const minPrice = Math.floor((basePrice * safeMinPercent) / 100);
  const maxPrice = Math.ceil((basePrice * safeMaxPercent) / 100);

  // Calculate percentage multiplier - this ensures full sliding scale from min to max
  const percentRange = safeMaxPercent - safeMinPercent;
  const randomPercent = safeMinPercent + random * percentRange;
  const priceMultiplier = randomPercent / 100;

  // Calculate randomized price and clamp between min/max bounds
  const randomizedPrice = Math.round(basePrice * priceMultiplier);
  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, randomizedPrice));

  // Ensure price is at least 1
  const finalPrice = Math.max(1, clampedPrice);

  // Optional: Add debug logging (remove in production)
  // console.log(`User ${userId.slice(0,8)}..., Item ${itemId}, Hour ${currentHour}: random=${random.toFixed(4)}, percent=${randomPercent.toFixed(1)}%, price=${basePrice}->${finalPrice}`);

  return finalPrice;
}

console.log(calculateRandomizedPrice("user123", "item456", 100));

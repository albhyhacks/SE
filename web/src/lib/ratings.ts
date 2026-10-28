// Rating labels (SPEC §5) and the photo-required rule.
export const RATINGS = [
  { value: 1, label: "Excellent", className: "bg-emerald-100 text-emerald-900" },
  { value: 2, label: "Good", className: "bg-green-100 text-green-900" },
  { value: 3, label: "Fair", className: "bg-yellow-100 text-yellow-900" },
  { value: 4, label: "Poor", className: "bg-orange-100 text-orange-900" },
  { value: 5, label: "Damaged", className: "bg-red-100 text-red-900" },
  { value: 6, label: "Missing", className: "bg-zinc-800 text-white" },
] as const;

export const ratingInfo = (v: number | null) => RATINGS.find((r) => r.value === v) ?? null;

export const photoRequired = (rating: number | null, isOverview: boolean) => isOverview || (rating ?? 0) >= 3;

/** An item is done when it is rated and meets the photo rule. */
export const itemDone = (i: { rating: number | null; is_overview: number | boolean; photos: unknown[] }) =>
  i.rating !== null && (!photoRequired(i.rating, !!i.is_overview) || i.photos.length > 0);

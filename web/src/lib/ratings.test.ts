import { describe, expect, it } from "vitest";
import { itemDone, photoRequired, ratingInfo } from "./ratings";

describe("ratings", () => {
  it("labels", () => {
    expect(ratingInfo(5)?.label).toBe("Damaged");
    expect(ratingInfo(null)).toBeNull();
  });
  it("photo rule", () => {
    expect(photoRequired(1, false)).toBe(false);
    expect(photoRequired(2, false)).toBe(false);
    expect(photoRequired(3, false)).toBe(true);
    expect(photoRequired(6, false)).toBe(true);
    expect(photoRequired(1, true)).toBe(true);
  });
  it("done", () => {
    expect(itemDone({ rating: null, is_overview: 0, photos: [] })).toBe(false);
    expect(itemDone({ rating: 2, is_overview: 0, photos: [] })).toBe(true);
    expect(itemDone({ rating: 5, is_overview: 0, photos: [] })).toBe(false);
    expect(itemDone({ rating: 5, is_overview: 0, photos: [{}] })).toBe(true);
    expect(itemDone({ rating: 1, is_overview: 1, photos: [] })).toBe(false);
  });
});

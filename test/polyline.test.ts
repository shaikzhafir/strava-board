import { describe, it, expect } from "vitest";
import { decodePolyline } from "../src/lib/polyline";

describe("decodePolyline", () => {
  it("decodes the canonical Google example", () => {
    // From https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const out = decodePolyline(encoded);
    expect(out).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("returns many points for a longer string without throwing", () => {
    // Simple two-point polyline
    const out = decodePolyline("_p~iF~ps|U_ulLnnqC");
    expect(out).toHaveLength(2);
    expect(out[0][0]).toBeCloseTo(38.5, 5);
  });
});

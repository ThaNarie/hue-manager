import { describe, expect, test } from "vite-plus/test";
import { parseLightMutationRequest, parseLightsResponse } from "../../shared/contracts/lights";

describe("lights contract", () => {
  test("parses a valid lights response", () => {
    const parsed = parseLightsResponse({
      generatedAt: "2026-03-28T12:00:00.000Z",
      lights: [
        {
          id: "light-001",
          name: "Kitchen Ceiling",
          type: "bulb",
          room: { id: "room-kitchen", name: "Kitchen" },
          zone: { id: "zone-downstairs", name: "Downstairs" },
          isOn: true,
          brightness: 84,
          lastUpdatedAt: "2026-03-28T11:59:00.000Z",
        },
      ],
    });

    expect(parsed.lights).toHaveLength(1);
    expect(parsed.lights[0].room.name).toBe("Kitchen");
  });

  test("rejects invalid brightness values", () => {
    expect(() =>
      parseLightsResponse({
        generatedAt: "2026-03-28T12:00:00.000Z",
        lights: [
          {
            id: "light-001",
            name: "Kitchen Ceiling",
            type: "bulb",
            room: { id: "room-kitchen", name: "Kitchen" },
            zone: null,
            isOn: true,
            brightness: 101,
            lastUpdatedAt: "2026-03-28T11:59:00.000Z",
          },
        ],
      }),
    ).toThrowError();
  });

  test("accepts light mutation payloads with safe fields", () => {
    const parsed = parseLightMutationRequest({ isOn: false, brightness: 0 });
    expect(parsed.isOn).toBe(false);
  });

  test("rejects empty light mutation payloads", () => {
    expect(() => parseLightMutationRequest({})).toThrowError();
  });
});

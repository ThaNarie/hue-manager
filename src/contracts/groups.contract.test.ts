import { describe, expect, test } from "vite-plus/test";
import { parseGroupMutationRequest, parseGroupsResponse } from "../../shared/contracts/groups";

describe("groups contract", () => {
  test("parses a valid rooms and zones response", () => {
    const parsed = parseGroupsResponse({
      generatedAt: "2026-03-30T09:00:00.000Z",
      groups: [
        {
          id: "room-1",
          hueGroupId: "1",
          kind: "room",
          name: "Kitchen",
          memberLightIds: ["4", "9"],
          members: [
            { id: "4", name: "Kitchen Lamp" },
            { id: "9", name: "Kitchen Counter" },
          ],
        },
      ],
      availableLights: [
        { id: "4", name: "Kitchen Lamp" },
        { id: "9", name: "Kitchen Counter" },
      ],
    });

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].members).toHaveLength(2);
  });

  test("accepts a mutation payload with renamed group", () => {
    const parsed = parseGroupMutationRequest({ name: "Dining Room" });
    expect(parsed.name).toBe("Dining Room");
  });

  test("rejects an empty mutation payload", () => {
    expect(() => parseGroupMutationRequest({})).toThrowError();
  });
});

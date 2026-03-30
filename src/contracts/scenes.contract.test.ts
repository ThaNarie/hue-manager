import { describe, expect, test } from "vite-plus/test";
import {
  parseSceneCreateRequest,
  parseSceneDeleteResponse,
  parseSceneUpdateRequest,
  parseScenesResponse,
} from "../../shared/contracts/scenes";

describe("scenes contract", () => {
  test("parses a valid scenes response", () => {
    const parsed = parseScenesResponse({
      generatedAt: "2026-03-30T12:00:00.000Z",
      scenes: [
        {
          id: "scene-001",
          name: "Relax",
          groupId: "1",
          isLocked: false,
          lastUpdatedAt: "2026-03-30T11:59:00.000Z",
        },
      ],
    });

    expect(parsed.scenes).toHaveLength(1);
    expect(parsed.scenes[0].name).toBe("Relax");
  });

  test("rejects empty scene create payload", () => {
    expect(() => parseSceneCreateRequest({ name: "   " })).toThrowError();
  });

  test("accepts valid scene update payload", () => {
    const parsed = parseSceneUpdateRequest({ name: "Movie Night" });
    expect(parsed.name).toBe("Movie Night");
  });

  test("rejects empty scene update payload", () => {
    expect(() => parseSceneUpdateRequest({})).toThrowError();
  });

  test("parses scene delete response", () => {
    const parsed = parseSceneDeleteResponse({ deletedSceneId: "scene-001" });
    expect(parsed.deletedSceneId).toBe("scene-001");
  });
});

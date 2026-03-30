import { describe, expect, test } from "vite-plus/test";
import type { Group } from "../../../shared/contracts/groups";
import {
  buildInitialGroupDrafts,
  hasGroupDraftChanges,
  replaceGroupById,
  toggleDraftMember,
  toGroupDraft,
} from "./GroupsDashboard.utils";

const GROUP_FIXTURE: Group = {
  id: "room-1",
  hueGroupId: "1",
  kind: "room",
  name: "Kitchen",
  memberLightIds: ["3", "4"],
  members: [
    { id: "3", name: "Sink" },
    { id: "4", name: "Ceiling" },
  ],
};

describe("GroupsDashboard.utils", () => {
  test("creates sorted draft from group", () => {
    expect(toGroupDraft({ ...GROUP_FIXTURE, memberLightIds: ["4", "3"] })).toEqual({
      name: "Kitchen",
      memberLightIds: ["3", "4"],
    });
  });

  test("toggles draft membership and keeps deterministic order", () => {
    const withAdded = toggleDraftMember({ name: "Kitchen", memberLightIds: ["4"] }, "2");
    expect(withAdded.memberLightIds).toEqual(["2", "4"]);

    const withRemoved = toggleDraftMember(withAdded, "4");
    expect(withRemoved.memberLightIds).toEqual(["2"]);
  });

  test("detects name and membership changes", () => {
    expect(
      hasGroupDraftChanges(GROUP_FIXTURE, {
        name: "Kitchen Updated",
        memberLightIds: ["3", "4"],
      }),
    ).toBe(true);

    expect(
      hasGroupDraftChanges(GROUP_FIXTURE, {
        name: "Kitchen",
        memberLightIds: ["3", "4", "5"],
      }),
    ).toBe(true);

    expect(hasGroupDraftChanges(GROUP_FIXTURE, toGroupDraft(GROUP_FIXTURE))).toBe(false);
  });

  test("builds drafts and replaces groups by id", () => {
    const drafts = buildInitialGroupDrafts([GROUP_FIXTURE]);
    expect(drafts["room-1"]).toEqual({ name: "Kitchen", memberLightIds: ["3", "4"] });

    const updated = replaceGroupById([GROUP_FIXTURE], { ...GROUP_FIXTURE, name: "Dining" });
    expect(updated[0].name).toBe("Dining");
  });
});

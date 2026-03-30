import type { Group } from "../../../shared/contracts/groups";
import type { GroupDraft } from "./GroupsDashboard.types";

export function toGroupDraft(group: Group): GroupDraft {
  return {
    name: group.name,
    memberLightIds: [...group.memberLightIds].sort((left, right) => left.localeCompare(right)),
  };
}

export function buildInitialGroupDrafts(groups: Group[]): Record<string, GroupDraft> {
  return Object.fromEntries(groups.map((group) => [group.id, toGroupDraft(group)]));
}

export function toggleDraftMember(draft: GroupDraft, lightId: string): GroupDraft {
  const nextIds = draft.memberLightIds.includes(lightId)
    ? draft.memberLightIds.filter((id) => id !== lightId)
    : [...draft.memberLightIds, lightId];
  return {
    ...draft,
    memberLightIds: nextIds.sort((left, right) => left.localeCompare(right)),
  };
}

export function hasGroupDraftChanges(group: Group, draft: GroupDraft): boolean {
  if (group.name !== draft.name.trim()) {
    return true;
  }
  const currentIds = [...group.memberLightIds].sort((left, right) => left.localeCompare(right));
  if (currentIds.length !== draft.memberLightIds.length) {
    return true;
  }
  return currentIds.some((id, index) => draft.memberLightIds[index] !== id);
}

export function replaceGroupById(groups: Group[], nextGroup: Group): Group[] {
  return groups.map((group) => (group.id === nextGroup.id ? nextGroup : group));
}

import type { Group, GroupKind } from "../../../shared/contracts/groups";
import type { GroupMutationRequest } from "../../../shared/contracts/groups";

export type GroupDraft = {
  name: string;
  memberLightIds: string[];
};

export type GroupMutationInput = {
  groupId: string;
  hueGroupId: string;
  kind: GroupKind;
  patch: GroupMutationRequest;
};

export type GroupErrorMap = Record<string, string>;

export type GroupsDashboardToast = {
  id: string;
  message: string;
};

export type GroupsDashboardData = {
  groups: Group[];
  availableLights: Array<{ id: string; name: string }>;
};

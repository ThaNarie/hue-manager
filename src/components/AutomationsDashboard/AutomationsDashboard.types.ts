import type { Automation } from "../../../shared/contracts/automations";
import type {
  AutomationActionMethod,
  AutomationCreateRequest,
  AutomationMutationRequest,
} from "../../../shared/contracts/automations";
import type { AutomationMutationSafetyApproval } from "../../../shared/safety/automationMutationSafetyPolicy";

export type AutomationSortOption = "name-asc" | "name-desc" | "updated-desc" | "updated-asc";
export type AutomationStatusFilter = "all" | "enabled" | "disabled";

export type AutomationFilters = {
  searchQuery: string;
  status: AutomationStatusFilter;
  sort: AutomationSortOption;
};

export type AutomationMutationInput = {
  automationId: string;
  patch: AutomationMutationRequest;
  approval: AutomationMutationSafetyApproval | null;
};

export type AutomationCreateInput = {
  draft: AutomationCreateRequest;
};

export type AutomationGuidedDraft = {
  name: string;
  isEnabled: boolean;
  conditionAddress: string;
  conditionOperator: string;
  conditionValue: string;
  actionAddress: string;
  actionMethod: AutomationActionMethod;
  actionBodyText: string;
  confirmDestructive: boolean;
  explicitDangerousToken: string;
};

export type AutomationGuidedDraftField =
  | "name"
  | "conditionAddress"
  | "conditionOperator"
  | "conditionValue"
  | "actionAddress"
  | "actionMethod"
  | "actionBodyText"
  | "confirmDestructive"
  | "explicitDangerousToken";

export type AutomationGuidedDraftErrors = Partial<Record<AutomationGuidedDraftField, string>>;

export type AutomationEditorVariant = "guided" | "json";

export type AutomationJsonDraft = {
  payloadText: string;
  confirmDestructive: boolean;
  explicitDangerousToken: string;
};

export type AutomationJsonDraftField =
  | "payloadText"
  | "confirmDestructive"
  | "explicitDangerousToken";

export type AutomationJsonDraftErrors = Partial<Record<AutomationJsonDraftField, string>>;

export type AutomationControlErrorMap = Record<string, string>;

export type AutomationsDashboardData = {
  automations: Automation[];
  filteredAutomations: Automation[];
};

export type AutomationsToast = {
  id: string;
  message: string;
};

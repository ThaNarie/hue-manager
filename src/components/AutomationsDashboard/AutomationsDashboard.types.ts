import type { Automation } from "../../../shared/contracts/automations";
import type { AutomationMutationRequest } from "../../../shared/contracts/automations";

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
};

export type AutomationControlErrorMap = Record<string, string>;

export type AutomationsDashboardData = {
  automations: Automation[];
  filteredAutomations: Automation[];
};

export type AutomationsToast = {
  id: string;
  message: string;
};

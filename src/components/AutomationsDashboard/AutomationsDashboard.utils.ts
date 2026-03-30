import type { Automation } from "../../../shared/contracts/automations";
import type {
  AutomationFilters,
  AutomationGuidedDraft,
  AutomationGuidedDraftErrors,
  AutomationSortOption,
  AutomationStatusFilter,
} from "./AutomationsDashboard.types";

export const AUTOMATION_SORT_OPTIONS: Array<{ value: AutomationSortOption; label: string }> = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "updated-desc", label: "Recently triggered" },
  { value: "updated-asc", label: "Least recently triggered" },
];

export const AUTOMATION_STATUS_OPTIONS: Array<{
  value: AutomationStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

export function getInitialAutomationFilters(): AutomationFilters {
  return {
    searchQuery: "",
    status: "all",
    sort: "name-asc",
  };
}

function compareBySort(left: Automation, right: Automation, sort: AutomationSortOption): number {
  switch (sort) {
    case "name-desc":
      return right.name.localeCompare(left.name);
    case "updated-desc":
      return toTimestamp(right.lastTriggeredAt) - toTimestamp(left.lastTriggeredAt);
    case "updated-asc":
      return toTimestamp(left.lastTriggeredAt) - toTimestamp(right.lastTriggeredAt);
    case "name-asc":
    default:
      return left.name.localeCompare(right.name);
  }
}

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }
  return new Date(value).getTime();
}

export function matchesAutomationSearchQuery(automation: Automation, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchableSegments = [
    automation.id,
    automation.name,
    automation.status,
    automation.owner ?? "",
  ].map((segment) => segment.toLowerCase());

  return searchableSegments.some((segment) => segment.includes(normalizedQuery));
}

export function filterAndSortAutomations(
  automations: Automation[],
  filters: AutomationFilters,
): Automation[] {
  return automations
    .filter((automation) => {
      if (!matchesAutomationSearchQuery(automation, filters.searchQuery)) {
        return false;
      }
      if (filters.status !== "all" && automation.status !== filters.status) {
        return false;
      }
      return true;
    })
    .sort((left, right) => compareBySort(left, right, filters.sort));
}

export function formatAutomationTriggeredAt(dateIsoString: string | null): string {
  if (!dateIsoString) {
    return "Never";
  }
  return new Date(dateIsoString).toLocaleString();
}

export function applyOptimisticAutomationPatch(
  automations: Automation[],
  automationId: string,
  isEnabled: boolean,
): Automation[] {
  return automations.map((automation) => {
    if (automation.id !== automationId) {
      return automation;
    }

    const status = isEnabled ? "enabled" : "disabled";
    return {
      ...automation,
      isEnabled,
      status,
    };
  });
}

export function replaceAutomationById(
  automations: Automation[],
  nextAutomation: Automation,
): Automation[] {
  return automations.map((automation) =>
    automation.id === nextAutomation.id ? nextAutomation : automation,
  );
}

export function getInitialAutomationGuidedDraft(): AutomationGuidedDraft {
  return {
    name: "",
    isEnabled: true,
    conditionAddress: "/sensors/1/state/status",
    conditionOperator: "eq",
    conditionValue: "1",
    actionAddress: "/groups/0/action",
    actionMethod: "PUT",
    actionBodyText: '{"on": true}',
    confirmDestructive: false,
    explicitDangerousToken: "",
  };
}

export function getGuidedDraftFromAutomation(automation: Automation): AutomationGuidedDraft {
  const firstCondition = automation.conditions[0];
  const firstAction = automation.actions[0];
  return {
    name: automation.name,
    isEnabled: automation.isEnabled,
    conditionAddress: firstCondition?.address ?? "",
    conditionOperator: firstCondition?.operator ?? "eq",
    conditionValue: firstCondition?.value ?? "",
    actionAddress: firstAction?.address ?? "",
    actionMethod: firstAction?.method ?? "PUT",
    actionBodyText: JSON.stringify(firstAction?.body ?? {}, null, 2),
    confirmDestructive: false,
    explicitDangerousToken: "",
  };
}

export function validateAutomationGuidedDraft(draft: AutomationGuidedDraft): {
  errors: AutomationGuidedDraftErrors;
  actionBody: Record<string, unknown> | null;
} {
  const errors: AutomationGuidedDraftErrors = {};
  if (draft.name.trim().length === 0) {
    errors.name = "Automation name is required.";
  } else if (draft.name.trim().length > 32) {
    errors.name = "Automation name must be 32 characters or fewer.";
  }
  if (draft.conditionAddress.trim().length === 0) {
    errors.conditionAddress = "Condition address is required.";
  }
  if (draft.conditionOperator.trim().length === 0) {
    errors.conditionOperator = "Condition operator is required.";
  }
  if (draft.conditionValue.trim().length === 0) {
    errors.conditionValue = "Condition value is required.";
  }
  if (draft.actionAddress.trim().length === 0) {
    errors.actionAddress = "Action address is required.";
  }

  let parsedActionBody: unknown = null;
  try {
    parsedActionBody = JSON.parse(draft.actionBodyText) as unknown;
  } catch {
    parsedActionBody = null;
  }
  const isValidActionBody =
    typeof parsedActionBody === "object" &&
    parsedActionBody !== null &&
    !Array.isArray(parsedActionBody);
  if (!isValidActionBody) {
    errors.actionBodyText = "Action body must be a JSON object.";
  }

  return {
    errors,
    actionBody: isValidActionBody ? (parsedActionBody as Record<string, unknown>) : null,
  };
}

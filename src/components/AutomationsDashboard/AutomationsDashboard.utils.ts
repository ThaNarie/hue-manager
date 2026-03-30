import type { Automation } from "../../../shared/contracts/automations";
import type {
  AutomationFilters,
  AutomationSortOption,
  AutomationStatusFilter,
  SavedAutomationView,
} from "./AutomationsDashboard.types";

export const AUTOMATION_SAVED_VIEWS_STORAGE_KEY = "hue-manager:automations:saved-views";

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

export function parseSavedAutomationViews(rawValue: string | null): SavedAutomationView[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((candidate): candidate is SavedAutomationView => {
        if (!candidate || typeof candidate !== "object") {
          return false;
        }
        const view = candidate as Partial<SavedAutomationView>;
        return (
          typeof view.name === "string" &&
          typeof view.filters?.searchQuery === "string" &&
          typeof view.filters?.status === "string" &&
          typeof view.filters?.sort === "string"
        );
      })
      .map((view) => ({
        name: view.name,
        filters: { ...view.filters },
      }));
  } catch {
    return [];
  }
}

export function upsertSavedAutomationView(
  views: SavedAutomationView[],
  nextView: SavedAutomationView,
): SavedAutomationView[] {
  const nextName = nextView.name.trim();
  if (!nextName) {
    return views;
  }

  const normalizedName = nextName.toLowerCase();
  const remainingViews = views.filter((view) => view.name.toLowerCase() !== normalizedName);
  return [
    ...remainingViews,
    {
      name: nextName,
      filters: { ...nextView.filters },
    },
  ];
}

export function removeSavedAutomationView(
  views: SavedAutomationView[],
  viewName: string,
): SavedAutomationView[] {
  const normalizedName = viewName.trim().toLowerCase();
  if (!normalizedName) {
    return views;
  }

  return views.filter((view) => view.name.toLowerCase() !== normalizedName);
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

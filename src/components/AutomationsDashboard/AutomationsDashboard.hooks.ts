import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseAutomationMutationRequest,
  parseAutomationMutationResponse,
  parseAutomationsResponse,
  type AutomationsResponse,
} from "../../../shared/contracts/automations";
import type {
  AutomationControlErrorMap,
  AutomationFilters,
  AutomationMutationInput,
  AutomationsDashboardData,
  AutomationsToast,
  SavedAutomationView,
} from "./AutomationsDashboard.types";
import {
  AUTOMATION_SAVED_VIEWS_STORAGE_KEY,
  applyOptimisticAutomationPatch,
  filterAndSortAutomations,
  getInitialAutomationFilters,
  parseSavedAutomationViews,
  removeSavedAutomationView,
  replaceAutomationById,
  upsertSavedAutomationView,
} from "./AutomationsDashboard.utils";

const AUTOMATIONS_QUERY_KEY = ["automations-dashboard"] as const;

async function requestAutomations() {
  const response = await fetch("/api/automations");
  if (!response.ok) {
    throw new Error(`Automations endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseAutomationsResponse(payload);
}

async function requestAutomationMutation(input: AutomationMutationInput) {
  const response = await fetch(`/api/automations/${encodeURIComponent(input.automationId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parseAutomationMutationRequest(input.patch)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Automation update failed (${response.status})`;
    throw new Error(message);
  }
  return parseAutomationMutationResponse(payload);
}

export function useAutomationsDashboard() {
  const [filters, setFilters] = useState<AutomationFilters>(getInitialAutomationFilters);
  const [savedViews, setSavedViews] = useState<SavedAutomationView[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseSavedAutomationViews(
      window.localStorage.getItem(AUTOMATION_SAVED_VIEWS_STORAGE_KEY),
    );
  });
  const [savedViewDraftName, setSavedViewDraftName] = useState("");
  const [selectedSavedViewName, setSelectedSavedViewName] = useState("");
  const [automationErrors, setAutomationErrors] = useState<AutomationControlErrorMap>({});
  const [pendingAutomationIds, setPendingAutomationIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<AutomationsToast[]>([]);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AUTOMATIONS_QUERY_KEY,
    queryFn: requestAutomations,
    staleTime: 10_000,
  });
  const mutation = useMutation({
    mutationFn: requestAutomationMutation,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTOMATIONS_QUERY_KEY });
      const previousData = queryClient.getQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY);
      if (previousData) {
        queryClient.setQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY, {
          ...previousData,
          generatedAt: new Date().toISOString(),
          automations: applyOptimisticAutomationPatch(
            previousData.automations,
            input.automationId,
            input.patch.isEnabled,
          ),
        });
      }
      setAutomationErrors((current) => {
        if (!current[input.automationId]) {
          return current;
        }
        const { [input.automationId]: _removed, ...rest } = current;
        return rest;
      });
      setPendingAutomationIds((current) => {
        if (current.includes(input.automationId)) {
          return current;
        }
        return [...current, input.automationId];
      });
      return { previousData, automationId: input.automationId };
    },
    onSuccess: (result, input) => {
      queryClient.setQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          automations: replaceAutomationById(current.automations, result.automation),
        };
      });
      setAutomationErrors((current) => {
        if (!current[input.automationId]) {
          return current;
        }
        const { [input.automationId]: _removed, ...rest } = current;
        return rest;
      });
    },
    onError: (error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(AUTOMATIONS_QUERY_KEY, context.previousData);
      }
      const automationId = context?.automationId;
      if (automationId) {
        setAutomationErrors((current) => ({
          ...current,
          [automationId]: error.message,
        }));
      }
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: error.message,
        },
      ]);
    },
    onSettled: (_data, _error, input) => {
      setPendingAutomationIds((current) =>
        current.filter((pendingId) => pendingId !== input.automationId),
      );
    },
  });

  const data: AutomationsDashboardData = useMemo(() => {
    const automations = query.data?.automations ?? [];
    const filteredAutomations = filterAndSortAutomations(automations, filters);
    return {
      automations,
      filteredAutomations,
    };
  }, [filters, query.data?.automations]);

  function updateFilters(nextPartial: Partial<AutomationFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextPartial,
    }));
  }

  function persistSavedViews(nextViews: SavedAutomationView[]) {
    setSavedViews(nextViews);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTOMATION_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(nextViews));
    }
  }

  function saveCurrentView() {
    const nextName = savedViewDraftName.trim();
    if (!nextName) {
      return;
    }

    const nextViews = upsertSavedAutomationView(savedViews, { name: nextName, filters });
    persistSavedViews(nextViews);
    setSavedViewDraftName("");
    setSelectedSavedViewName(nextName);
  }

  function applySelectedSavedView() {
    if (!selectedSavedViewName) {
      return;
    }
    const selectedView = savedViews.find((view) => view.name === selectedSavedViewName);
    if (!selectedView) {
      return;
    }
    setFilters({ ...selectedView.filters });
  }

  function deleteSelectedSavedView() {
    if (!selectedSavedViewName) {
      return;
    }
    const nextViews = removeSavedAutomationView(savedViews, selectedSavedViewName);
    persistSavedViews(nextViews);
    setSelectedSavedViewName("");
  }

  function updateAutomation(automationId: string, isEnabled: boolean) {
    mutation.mutate({ automationId, patch: { isEnabled } });
  }

  function bulkEnableFilteredAutomations() {
    data.filteredAutomations.forEach((automation) => {
      if (!automation.isEnabled) {
        updateAutomation(automation.id, true);
      }
    });
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    automationErrors,
    bulkEnableFilteredAutomations,
    dismissToast,
    filters,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    pendingAutomationIds,
    saveCurrentView,
    savedViewDraftName,
    savedViews,
    selectedSavedViewName,
    error: query.error,
    refresh: query.refetch,
    toasts,
    updateAutomation,
    updateFilters,
    applySelectedSavedView,
    deleteSelectedSavedView,
    setSavedViewDraftName,
    setSelectedSavedViewName,
  };
}

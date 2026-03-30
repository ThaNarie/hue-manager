import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutomationsResponse } from "../../../shared/contracts/automations";
import {
  DANGEROUS_AUTOMATION_MUTATION_TOKEN,
  getAutomationMutationSafetyAction,
} from "../../../shared/safety/automationMutationSafetyPolicy";
import {
  requestAutomationCreate,
  requestAutomationMutation,
  requestAutomations,
} from "./AutomationsDashboard.api";
import type {
  AutomationControlErrorMap,
  AutomationFilters,
  AutomationMutationInput,
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
import { useAutomationsDashboardEditorState } from "./AutomationsDashboardEditor.hooks";
import { useBridgeWriteGate } from "../OverviewHealthCard/OverviewHealthCard.hooks";

const AUTOMATIONS_QUERY_KEY = ["automations-dashboard"] as const;

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
  const editorState = useAutomationsDashboardEditorState();
  const queryClient = useQueryClient();
  const { isBridgeOffline } = useBridgeWriteGate();
  const query = useQuery({
    queryKey: AUTOMATIONS_QUERY_KEY,
    queryFn: requestAutomations,
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: (input: AutomationMutationInput) =>
      requestAutomationMutation(input.automationId, input.patch, input.approval),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTOMATIONS_QUERY_KEY });
      const previousData = queryClient.getQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY);
      if (previousData) {
        queryClient.setQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY, {
          ...previousData,
          generatedAt: new Date().toISOString(),
          automations:
            input.patch.isEnabled === undefined
              ? previousData.automations
              : applyOptimisticAutomationPatch(
                  previousData.automations,
                  input.automationId,
                  input.patch.isEnabled,
                ),
        });
      }
      setAutomationErrors((current) => {
        const { [input.automationId]: _removed, ...rest } = current;
        return rest;
      });
      setPendingAutomationIds((current) =>
        current.includes(input.automationId) ? current : [...current, input.automationId],
      );
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
        const { [input.automationId]: _removed, ...rest } = current;
        return rest;
      });
      if (input.patch.name !== undefined || input.patch.conditions || input.patch.actions) {
        editorState.resetEditorState();
        setToasts((current) => [
          ...current,
          { id: crypto.randomUUID(), message: `Updated automation "${result.automation.name}".` },
        ]);
      }
    },
    onError: (error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(AUTOMATIONS_QUERY_KEY, context.previousData);
      }
      if (context?.automationId) {
        setAutomationErrors((current) => ({
          ...current,
          [context.automationId]: error.message,
        }));
      }
      setToasts((current) => [...current, { id: crypto.randomUUID(), message: error.message }]);
    },
    onSettled: (_data, _error, input) => {
      setPendingAutomationIds((current) =>
        current.filter((pendingId) => pendingId !== input.automationId),
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: ({
      input,
      approval,
    }: {
      input: Parameters<typeof requestAutomationCreate>[0];
      approval: Parameters<typeof requestAutomationCreate>[1];
    }) => requestAutomationCreate(input, approval),
    onSuccess: (result) => {
      queryClient.setQueryData<AutomationsResponse>(AUTOMATIONS_QUERY_KEY, (current) => {
        if (!current) {
          return { generatedAt: new Date().toISOString(), automations: [result.automation] };
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          automations: [...current.automations, result.automation].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        };
      });
      editorState.resetEditorState();
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: `Created automation "${result.automation.name}".` },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [...current, { id: crypto.randomUUID(), message: error.message }]);
    },
  });

  function updateFilters(nextPartial: Partial<AutomationFilters>) {
    setFilters((current) => ({ ...current, ...nextPartial }));
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
    if (isBridgeOffline) {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: "Bridge offline. Reconnect before updating automations.",
        },
      ]);
      return;
    }
    const patch = { isEnabled };
    const requiredAction = getAutomationMutationSafetyAction(patch);
    if (requiredAction === "confirm") {
      const approved = window.confirm(
        "Disabling this automation is destructive. Confirm disable to continue.",
      );
      if (!approved) {
        return;
      }
    }
    mutation.mutate({
      automationId,
      patch,
      approval:
        requiredAction === "immediate"
          ? null
          : requiredAction === "confirm"
            ? { action: "confirm" as const }
            : { action: "explicit" as const, token: DANGEROUS_AUTOMATION_MUTATION_TOKEN },
    });
  }

  function onCancelGuidedEdit() {
    editorState.resetEditorState();
  }

  function onSubmitGuidedAutomation() {
    const plan = editorState.getGuidedMutationPlan();
    if (!plan) {
      return;
    }
    if (editorState.guidedMode === "create") {
      createMutation.mutate({ input: plan.payload, approval: plan.approval });
      return;
    }
    if (!editorState.editingAutomationId) {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: "No automation selected for guided edit." },
      ]);
      return;
    }
    mutation.mutate({
      automationId: editorState.editingAutomationId,
      patch: plan.payload,
      approval: plan.approval,
    });
  }

  function onSubmitJsonAutomation() {
    if (!editorState.editingAutomationId) {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: "No automation selected for JSON edit." },
      ]);
      return;
    }
    const plan = editorState.getJsonMutationPlan();
    if (!plan) {
      return;
    }
    mutation.mutate(
      {
        automationId: editorState.editingAutomationId,
        patch: plan.payload,
        approval: plan.approval,
      },
      {
        onError: (error) => {
          editorState.setJsonApiError(error.message);
        },
      },
    );
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  const automations = query.data?.automations ?? [];
  const filteredAutomations = filterAndSortAutomations(automations, filters);

  function bulkEnableFilteredAutomations() {
    filteredAutomations.forEach((automation) => {
      if (!automation.isEnabled) {
        updateAutomation(automation.id, true);
      }
    });
  }

  return {
    automations,
    filteredAutomations,
    automationErrors,
    bulkEnableFilteredAutomations,
    dismissToast,
    editorVariant: editorState.editorVariant,
    error: query.error,
    filters,
    guidedDraft: editorState.guidedDraft,
    guidedDraftErrors: editorState.guidedDraftErrors,
    guidedMode: editorState.guidedMode,
    isLoading: query.isLoading,
    isBridgeOffline,
    isRefreshing: query.isFetching,
    isSavingGuidedAutomation: mutation.isPending || createMutation.isPending,
    jsonApiError: editorState.jsonApiError,
    jsonDraft: editorState.jsonDraft,
    jsonDraftErrors: editorState.jsonDraftErrors,
    pendingAutomationIds,
    saveCurrentView,
    savedViewDraftName,
    savedViews,
    selectedSavedViewName,
    onCancelGuidedEdit,
    onSubmitGuidedAutomation,
    onSubmitJsonAutomation,
    refresh: query.refetch,
    requiredGuidedSafetyAction: editorState.requiredGuidedSafetyAction,
    requiredJsonSafetyAction: editorState.requiredJsonSafetyAction,
    setEditorVariant: editorState.setEditorVariant,
    setGuidedDraft: editorState.setGuidedDraft,
    setJsonDraft: editorState.setJsonDraft,
    startGuidedEdit: editorState.startGuidedEdit,
    startJsonEdit: editorState.startJsonEdit,
    toasts,
    updateAutomation,
    updateFilters,
    applySelectedSavedView,
    deleteSelectedSavedView,
    setSavedViewDraftName,
    setSelectedSavedViewName,
  };
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Automation, AutomationsResponse } from "../../../shared/contracts/automations";
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
  AutomationGuidedDraftErrors,
  AutomationMutationInput,
  AutomationsDashboardData,
  AutomationsToast,
} from "./AutomationsDashboard.types";
import {
  applyOptimisticAutomationPatch,
  filterAndSortAutomations,
  getGuidedDraftFromAutomation,
  getInitialAutomationFilters,
  getInitialAutomationGuidedDraft,
  replaceAutomationById,
  validateAutomationGuidedDraft,
} from "./AutomationsDashboard.utils";

const AUTOMATIONS_QUERY_KEY = ["automations-dashboard"] as const;

export function useAutomationsDashboard() {
  const [filters, setFilters] = useState<AutomationFilters>(getInitialAutomationFilters);
  const [automationErrors, setAutomationErrors] = useState<AutomationControlErrorMap>({});
  const [pendingAutomationIds, setPendingAutomationIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<AutomationsToast[]>([]);
  const [guidedMode, setGuidedMode] = useState<"create" | "edit">("create");
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [guidedDraft, setGuidedDraftState] = useState(getInitialAutomationGuidedDraft);
  const [guidedDraftErrors, setGuidedDraftErrors] = useState<AutomationGuidedDraftErrors>({});
  const queryClient = useQueryClient();
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
      if (
        input.patch.name !== undefined ||
        input.patch.conditions !== undefined ||
        input.patch.actions !== undefined
      ) {
        setGuidedMode("create");
        setEditingAutomationId(null);
        setGuidedDraftState(getInitialAutomationGuidedDraft());
        setGuidedDraftErrors({});
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
          return {
            generatedAt: new Date().toISOString(),
            automations: [result.automation],
          };
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          automations: [...current.automations, result.automation].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        };
      });
      setGuidedDraftState(getInitialAutomationGuidedDraft());
      setGuidedDraftErrors({});
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: `Created automation "${result.automation.name}".` },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [...current, { id: crypto.randomUUID(), message: error.message }]);
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

  function updateAutomation(automationId: string, isEnabled: boolean) {
    const patch = { isEnabled };
    const requiredAction = getAutomationMutationSafetyAction(patch);
    if (requiredAction === "confirm") {
      const isApproved = window.confirm(
        "Disabling this automation is destructive. Confirm disable to continue.",
      );
      if (!isApproved) {
        return;
      }
    }
    const approval =
      requiredAction === "immediate"
        ? null
        : requiredAction === "confirm"
          ? { action: "confirm" as const }
          : {
              action: "explicit" as const,
              token: DANGEROUS_AUTOMATION_MUTATION_TOKEN,
            };
    mutation.mutate({ automationId, patch, approval });
  }

  function setGuidedDraft(nextDraft: typeof guidedDraft) {
    setGuidedDraftState(nextDraft);
    setGuidedDraftErrors({});
  }

  function startGuidedEdit(automation: Automation) {
    setGuidedMode("edit");
    setEditingAutomationId(automation.id);
    setGuidedDraftState(getGuidedDraftFromAutomation(automation));
    setGuidedDraftErrors({});
  }

  function onCancelGuidedEdit() {
    setGuidedMode("create");
    setEditingAutomationId(null);
    setGuidedDraftState(getInitialAutomationGuidedDraft());
    setGuidedDraftErrors({});
  }

  function getGuidedMutationPlan() {
    const validation = validateAutomationGuidedDraft(guidedDraft);
    const nextErrors: AutomationGuidedDraftErrors = { ...validation.errors };
    if (!validation.actionBody) {
      setGuidedDraftErrors(nextErrors);
      return null;
    }

    const mutationPayload = {
      name: guidedDraft.name.trim(),
      isEnabled: guidedDraft.isEnabled,
      conditions: [
        {
          address: guidedDraft.conditionAddress.trim(),
          operator: guidedDraft.conditionOperator.trim(),
          value: guidedDraft.conditionValue.trim(),
        },
      ],
      actions: [
        {
          address: guidedDraft.actionAddress.trim(),
          method: guidedDraft.actionMethod,
          body: validation.actionBody,
        },
      ],
    };
    const requiredAction = getAutomationMutationSafetyAction(mutationPayload);
    if (requiredAction === "confirm" && !guidedDraft.confirmDestructive) {
      nextErrors.confirmDestructive = "Required for this write.";
    }
    if (
      requiredAction === "explicit" &&
      guidedDraft.explicitDangerousToken.trim() !== DANGEROUS_AUTOMATION_MUTATION_TOKEN
    ) {
      nextErrors.explicitDangerousToken = "Dangerous confirmation token does not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setGuidedDraftErrors(nextErrors);
      return null;
    }
    setGuidedDraftErrors({});
    return {
      payload: mutationPayload,
      approval:
        requiredAction === "immediate"
          ? null
          : requiredAction === "confirm"
            ? { action: "confirm" as const }
            : {
                action: "explicit" as const,
                token: guidedDraft.explicitDangerousToken.trim(),
              },
    };
  }

  function onSubmitGuidedAutomation() {
    const plan = getGuidedMutationPlan();
    if (!plan) {
      return;
    }
    if (guidedMode === "create") {
      createMutation.mutate({ input: plan.payload, approval: plan.approval });
      return;
    }
    if (!editingAutomationId) {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: "No automation selected for guided edit." },
      ]);
      return;
    }
    mutation.mutate({
      automationId: editingAutomationId,
      patch: plan.payload,
      approval: plan.approval,
    });
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  const requiredGuidedSafetyAction = useMemo(() => {
    const validation = validateAutomationGuidedDraft(guidedDraft);
    if (!validation.actionBody) {
      return "immediate";
    }
    return getAutomationMutationSafetyAction({
      name: guidedDraft.name.trim(),
      isEnabled: guidedDraft.isEnabled,
      conditions: [
        {
          address: guidedDraft.conditionAddress.trim(),
          operator: guidedDraft.conditionOperator.trim(),
          value: guidedDraft.conditionValue.trim(),
        },
      ],
      actions: [
        {
          address: guidedDraft.actionAddress.trim(),
          method: guidedDraft.actionMethod,
          body: validation.actionBody,
        },
      ],
    });
  }, [guidedDraft]);

  return {
    ...data,
    automationErrors,
    dismissToast,
    filters,
    guidedMode,
    guidedDraft,
    guidedDraftErrors,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    isSavingGuidedAutomation: mutation.isPending || createMutation.isPending,
    pendingAutomationIds,
    error: query.error,
    onCancelGuidedEdit,
    onSubmitGuidedAutomation,
    requiredGuidedSafetyAction,
    refresh: query.refetch,
    setGuidedDraft,
    startGuidedEdit,
    toasts,
    updateAutomation,
    updateFilters,
  };
}

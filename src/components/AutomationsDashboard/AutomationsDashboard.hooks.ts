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
} from "./AutomationsDashboard.types";
import {
  applyOptimisticAutomationPatch,
  filterAndSortAutomations,
  getInitialAutomationFilters,
  replaceAutomationById,
} from "./AutomationsDashboard.utils";
import { useBridgeWriteGate } from "../OverviewHealthCard/OverviewHealthCard.hooks";

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
  const [automationErrors, setAutomationErrors] = useState<AutomationControlErrorMap>({});
  const [pendingAutomationIds, setPendingAutomationIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<AutomationsToast[]>([]);
  const queryClient = useQueryClient();
  const { isBridgeOffline } = useBridgeWriteGate();
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

    mutation.mutate({ automationId, patch: { isEnabled } });
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    automationErrors,
    dismissToast,
    filters,
    isLoading: query.isLoading,
    isBridgeOffline,
    isRefreshing: query.isFetching,
    pendingAutomationIds,
    error: query.error,
    refresh: query.refetch,
    toasts,
    updateAutomation,
    updateFilters,
  };
}

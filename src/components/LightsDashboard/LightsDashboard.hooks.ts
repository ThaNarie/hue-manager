import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseLightMutationRequest,
  parseLightMutationResponse,
  parseLightsResponse,
  type LightsResponse,
} from "../../../shared/contracts/lights";
import {
  type DashboardToast,
  type LightControlErrorMap,
  type LightFilters,
  type LightMutationInput,
  type LightsDashboardData,
} from "./LightsDashboard.types";
import {
  SAFETY_APPROVAL_ACTION_HEADER,
  SAFETY_APPROVAL_TOKEN_HEADER,
  getLightMutationSafetyAction,
} from "../../../shared/safety/lightMutationSafetyPolicy";
import {
  applyOptimisticLightPatch,
  buildRoomOptions,
  buildZoneOptions,
  filterAndSortLights,
  getInitialLightFilters,
  replaceLightById,
} from "./LightsDashboard.utils";

const LIGHTS_QUERY_KEY = ["lights-dashboard"] as const;
const DESTRUCTIVE_CONFIRM_WINDOW_MS = 8_000;

type PendingSafetyConfirmation = {
  key: string;
  expiresAt: number;
};

async function requestLights() {
  const response = await fetch("/api/lights");
  if (!response.ok) {
    throw new Error(`Lights endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseLightsResponse(payload);
}

async function requestLightMutation(input: LightMutationInput) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.approval) {
    headers[SAFETY_APPROVAL_ACTION_HEADER] = input.approval.action;
    if (input.approval.token) {
      headers[SAFETY_APPROVAL_TOKEN_HEADER] = input.approval.token;
    }
  }

  const response = await fetch(`/api/lights/${encodeURIComponent(input.lightId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(parseLightMutationRequest(input.patch)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Light update failed (${response.status})`;
    throw new Error(message);
  }

  return parseLightMutationResponse(payload);
}

export function useLightsDashboard() {
  const [filters, setFilters] = useState<LightFilters>(getInitialLightFilters);
  const [lightErrors, setLightErrors] = useState<LightControlErrorMap>({});
  const [pendingLightIds, setPendingLightIds] = useState<string[]>([]);
  const [pendingSafetyConfirmation, setPendingSafetyConfirmation] =
    useState<PendingSafetyConfirmation | null>(null);
  const [toasts, setToasts] = useState<DashboardToast[]>([]);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: LIGHTS_QUERY_KEY,
    queryFn: requestLights,
    staleTime: 10_000,
  });
  const mutation = useMutation({
    mutationFn: requestLightMutation,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: LIGHTS_QUERY_KEY });
      const previousData = queryClient.getQueryData<LightsResponse>(LIGHTS_QUERY_KEY);
      if (previousData) {
        queryClient.setQueryData<LightsResponse>(LIGHTS_QUERY_KEY, {
          ...previousData,
          generatedAt: new Date().toISOString(),
          lights: applyOptimisticLightPatch(previousData.lights, input.lightId, input.patch),
        });
      }
      setLightErrors((current) => {
        if (!current[input.lightId]) {
          return current;
        }

        const { [input.lightId]: _removed, ...rest } = current;
        return rest;
      });
      setPendingLightIds((current) => {
        if (current.includes(input.lightId)) {
          return current;
        }
        return [...current, input.lightId];
      });
      return { previousData, lightId: input.lightId };
    },
    onSuccess: (result, input) => {
      queryClient.setQueryData<LightsResponse>(LIGHTS_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          generatedAt: new Date().toISOString(),
          lights: replaceLightById(current.lights, result.light),
        };
      });
      setLightErrors((current) => {
        if (!current[input.lightId]) {
          return current;
        }

        const { [input.lightId]: _removed, ...rest } = current;
        return rest;
      });
    },
    onError: (error, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(LIGHTS_QUERY_KEY, context.previousData);
      }
      const lightId = context?.lightId;
      if (lightId) {
        setLightErrors((current) => ({
          ...current,
          [lightId]: error.message,
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
      setPendingLightIds((current) => current.filter((pendingId) => pendingId !== input.lightId));
    },
  });

  const data: LightsDashboardData = useMemo(() => {
    const lights = query.data?.lights ?? [];
    const filteredLights = filterAndSortLights(lights, filters);

    return {
      lights,
      filteredLights,
      roomOptions: buildRoomOptions(lights),
      zoneOptions: buildZoneOptions(lights),
    };
  }, [filters, query.data?.lights]);

  function updateFilters(nextPartial: Partial<LightFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextPartial,
    }));
  }

  function updateLight(lightId: string, patch: LightMutationInput["patch"]) {
    const now = Date.now();
    const requiredAction = getLightMutationSafetyAction(patch);

    if (requiredAction === "confirm") {
      const confirmationKey = `${lightId}:${JSON.stringify(patch)}`;
      if (
        !pendingSafetyConfirmation ||
        pendingSafetyConfirmation.key !== confirmationKey ||
        pendingSafetyConfirmation.expiresAt < now
      ) {
        setPendingSafetyConfirmation({
          key: confirmationKey,
          expiresAt: now + DESTRUCTIVE_CONFIRM_WINDOW_MS,
        });
        setToasts((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            message: "Repeat this action to confirm the destructive mutation.",
          },
        ]);
        return;
      }
      setPendingSafetyConfirmation(null);
      mutation.mutate({ lightId, patch, approval: { action: "confirm" } });
      return;
    }

    if (requiredAction === "explicit") {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: "Dangerous mutation blocked: explicit approval token is required.",
        },
      ]);
      return;
    }

    mutation.mutate({ lightId, patch, approval: null });
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    dismissToast,
    filters,
    isLoading: query.isLoading,
    lightErrors,
    pendingLightIds,
    isRefreshing: query.isFetching,
    error: query.error,
    refresh: query.refetch,
    toasts,
    updateLight,
    updateFilters,
  };
}

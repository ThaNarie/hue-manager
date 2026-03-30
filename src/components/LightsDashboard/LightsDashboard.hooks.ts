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
  applyOptimisticLightPatch,
  buildRoomOptions,
  buildZoneOptions,
  filterAndSortLights,
  getInitialLightFilters,
  replaceLightById,
} from "./LightsDashboard.utils";

const LIGHTS_QUERY_KEY = ["lights-dashboard"] as const;

async function requestLights() {
  const response = await fetch("/api/lights");
  if (!response.ok) {
    throw new Error(`Lights endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseLightsResponse(payload);
}

async function requestLightMutation(input: LightMutationInput) {
  const response = await fetch(`/api/lights/${encodeURIComponent(input.lightId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
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
    mutation.mutate({ lightId, patch });
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

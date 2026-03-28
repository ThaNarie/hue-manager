import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseLightsResponse } from "../../../shared/contracts/lights";
import { type LightFilters, type LightsDashboardData } from "./LightsDashboard.types";
import {
  buildRoomOptions,
  buildZoneOptions,
  filterAndSortLights,
  getInitialLightFilters,
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

export function useLightsDashboard() {
  const [filters, setFilters] = useState<LightFilters>(getInitialLightFilters);
  const query = useQuery({
    queryKey: LIGHTS_QUERY_KEY,
    queryFn: requestLights,
    staleTime: 10_000,
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

  return {
    ...data,
    filters,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error: query.error,
    refresh: query.refetch,
    updateFilters,
  };
}

import { useQuery } from "@tanstack/react-query";
import { parseOverviewHealthResponse } from "../../../shared/contracts/health";
import { getHealthPollMs } from "./OverviewHealthCard.utils";

const HEALTH_POLL_MS = getHealthPollMs(import.meta.env.VITE_HEALTH_POLL_MS);
const OVERVIEW_HEALTH_QUERY_KEY = ["overview-health"] as const;

async function requestOverviewHealth() {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseOverviewHealthResponse(payload);
}

export function useOverviewHealthCard() {
  const query = useQuery({
    queryKey: OVERVIEW_HEALTH_QUERY_KEY,
    queryFn: requestOverviewHealth,
    refetchInterval: HEALTH_POLL_MS,
  });

  async function refresh(): Promise<void> {
    await query.refetch();
  }

  return {
    error: query.error,
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    pollMs: HEALTH_POLL_MS,
    refresh,
    health: query.data,
  };
}

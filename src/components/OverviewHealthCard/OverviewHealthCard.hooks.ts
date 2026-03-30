import { useQuery } from "@tanstack/react-query";
import { parseOverviewHealthResponse } from "../../../shared/contracts/health";
import { getHealthPollMs } from "./OverviewHealthCard.utils";

const HEALTH_POLL_MS = getHealthPollMs(import.meta.env.VITE_HEALTH_POLL_MS);
const OVERVIEW_HEALTH_QUERY_KEY = ["overview-health"] as const;
const MAX_RETRY_DELAY_MS = 30_000;

async function requestBridgeProbe() {
  const response = await fetch("/api/lights");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Bridge probe failed (${response.status})`;
    throw new Error(message);
  }
}

async function requestOverviewHealth() {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health endpoint failed (${response.status})`);
  }
  const payload = await response.json();
  const health = parseOverviewHealthResponse(payload);
  await requestBridgeProbe();
  return health;
}

function useOverviewHealthQuery() {
  return useQuery({
    queryKey: OVERVIEW_HEALTH_QUERY_KEY,
    queryFn: requestOverviewHealth,
    refetchInterval: HEALTH_POLL_MS,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(2 ** attemptIndex * 1_000, MAX_RETRY_DELAY_MS),
  });
}

export function useOverviewHealthCard() {
  const query = useOverviewHealthQuery();

  async function refresh(): Promise<void> {
    await query.refetch();
  }

  return {
    isBridgeOffline: query.error !== null,
    error: query.error,
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    isStale: query.error !== null && query.data !== undefined,
    lastFreshAt: query.data?.generatedAt ?? null,
    pollMs: HEALTH_POLL_MS,
    refresh,
    health: query.data,
  };
}

export function useBridgeWriteGate() {
  const query = useOverviewHealthQuery();
  return {
    isBridgeOffline: query.error !== null,
    isCheckingBridge: query.isLoading && query.data === undefined,
  };
}

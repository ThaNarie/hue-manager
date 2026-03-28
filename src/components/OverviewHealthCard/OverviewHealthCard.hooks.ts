import { useCallback, useEffect, useRef, useState } from "react";
import { parseOverviewHealthResponse } from "../../../shared/contracts/health";
import type { OverviewHealthCardState } from "./OverviewHealthCard.types";
import { getHealthPollMs } from "./OverviewHealthCard.utils";

const HEALTH_POLL_MS = getHealthPollMs(import.meta.env.VITE_HEALTH_POLL_MS);

async function requestOverviewHealth(): Promise<OverviewHealthCardState> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      return {
        status: "error",
        message: `Health endpoint failed (${response.status})`,
      };
    }

    const payload = await response.json();
    const parsed = parseOverviewHealthResponse(payload);
    return { status: "ready", data: parsed };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown health error",
    };
  }
}

export function useOverviewHealthCard() {
  const [health, setHealth] = useState<OverviewHealthCardState>({
    status: "loading",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const isRequestInFlightRef = useRef(false);

  const runRequest = useCallback(async (showRefreshingState: boolean): Promise<void> => {
    if (isRequestInFlightRef.current) {
      return;
    }

    isRequestInFlightRef.current = true;
    if (showRefreshingState && isMountedRef.current) {
      setIsRefreshing(true);
    }

    try {
      const nextState = await requestOverviewHealth();
      if (isMountedRef.current) {
        setHealth(nextState);
      }
    } finally {
      isRequestInFlightRef.current = false;
      if (showRefreshingState && isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void runRequest(false);

    const timerId = window.setInterval(() => {
      void runRequest(true);
    }, HEALTH_POLL_MS);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(timerId);
    };
  }, [runRequest]);

  const refresh = useCallback(async (): Promise<void> => {
    await runRequest(true);
  }, [runRequest]);

  return {
    health,
    isRefreshing,
    pollMs: HEALTH_POLL_MS,
    refresh,
  };
}

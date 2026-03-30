import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAuditEventsResponse } from "../../../shared/contracts/audit";
import type { AuditActivityData } from "./AuditActivity.types";

const AUDIT_EVENTS_QUERY_KEY = ["audit-events"] as const;

async function requestAuditEvents() {
  const response = await fetch("/api/audit/events");
  if (!response.ok) {
    throw new Error(`Audit events endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseAuditEventsResponse(payload);
}

async function requestRetentionUpdate(retentionDays: number) {
  const response = await fetch("/api/audit/retention", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retentionDays }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Retention update failed (${response.status})`;
    throw new Error(message);
  }

  return parseAuditEventsResponse(payload);
}

async function requestPurgeEvents() {
  const response = await fetch("/api/audit/events", {
    method: "DELETE",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Audit purge failed (${response.status})`;
    throw new Error(message);
  }

  return parseAuditEventsResponse(payload);
}

async function requestExportEvents() {
  const response = await fetch("/api/audit/export");
  if (!response.ok) {
    throw new Error(`Audit export failed (${response.status})`);
  }

  const payload = parseAuditEventsResponse(await response.json());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `hue-manager-audit-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function useAuditActivity() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AUDIT_EVENTS_QUERY_KEY,
    queryFn: requestAuditEvents,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [retentionInput, setRetentionInput] = useState("90");
  const retentionMutation = useMutation({
    mutationFn: requestRetentionUpdate,
    onSuccess: (payload) => {
      queryClient.setQueryData(AUDIT_EVENTS_QUERY_KEY, payload);
    },
  });
  const purgeMutation = useMutation({
    mutationFn: requestPurgeEvents,
    onSuccess: (payload) => {
      queryClient.setQueryData(AUDIT_EVENTS_QUERY_KEY, payload);
    },
  });
  const exportMutation = useMutation({
    mutationFn: requestExportEvents,
  });

  useEffect(() => {
    const retentionDays = query.data?.retentionDays;
    if (typeof retentionDays === "number") {
      const nextValue = String(retentionDays);
      setRetentionInput((current) => (current === nextValue ? current : nextValue));
    }
  }, [query.data?.retentionDays]);

  const data: AuditActivityData = {
    retentionDays: query.data?.retentionDays ?? 90,
    events: query.data?.events ?? [],
  };

  return {
    ...data,
    error: query.error ?? retentionMutation.error ?? purgeMutation.error ?? exportMutation.error,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    isUpdatingRetention: retentionMutation.isPending,
    isPurging: purgeMutation.isPending,
    isExporting: exportMutation.isPending,
    retentionInput,
    setRetentionInput,
    refresh: query.refetch,
    applyRetention: retentionMutation.mutate,
    purgeEvents: purgeMutation.mutate,
    exportEvents: exportMutation.mutate,
  };
}

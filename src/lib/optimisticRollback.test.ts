import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vite-plus/test";
import { rollbackOptimisticQueryData } from "./optimisticRollback";

describe("optimistic rollback", () => {
  test("restores previous snapshot when available", () => {
    const queryClient = new QueryClient();
    const queryKey = ["lights-dashboard"] as const;
    const previousData = { generatedAt: "2026-03-30T00:00:00.000Z", lights: [{ id: "1" }] };
    const optimisticData = { generatedAt: "2026-03-30T00:01:00.000Z", lights: [{ id: "2" }] };
    queryClient.setQueryData(queryKey, optimisticData);

    const didRollback = rollbackOptimisticQueryData(queryClient, queryKey, previousData);

    expect(didRollback).toBe(true);
    expect(queryClient.getQueryData(queryKey)).toEqual(previousData);
  });

  test("skips rollback when previous snapshot is missing", () => {
    const queryClient = new QueryClient();
    const queryKey = ["automations-dashboard"] as const;
    const optimisticData = { generatedAt: "2026-03-30T00:01:00.000Z", automations: [{ id: "9" }] };
    queryClient.setQueryData(queryKey, optimisticData);

    const didRollback = rollbackOptimisticQueryData(queryClient, queryKey, undefined);

    expect(didRollback).toBe(false);
    expect(queryClient.getQueryData(queryKey)).toEqual(optimisticData);
  });
});

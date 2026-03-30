import type { QueryClient, QueryKey } from "@tanstack/react-query";

export function rollbackOptimisticQueryData<TQueryData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  previousData: TQueryData | undefined,
): boolean {
  if (previousData === undefined) {
    return false;
  }
  queryClient.setQueryData(queryKey, previousData);
  return true;
}

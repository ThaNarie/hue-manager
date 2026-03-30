import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BackupsResponse } from "../../../shared/contracts/backups";
import { requestBackupCreate, requestBackupRestore, requestBackups } from "./BackupsDashboard.api";
import type { BackupsDashboardData, BackupToast } from "./BackupsDashboard.types";

const BACKUPS_QUERY_KEY = ["backups-dashboard"] as const;

export function useBackupsDashboard() {
  const [toasts, setToasts] = useState<BackupToast[]>([]);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: BACKUPS_QUERY_KEY,
    queryFn: requestBackups,
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: requestBackupCreate,
    onSuccess: (result) => {
      queryClient.setQueryData<BackupsResponse>(BACKUPS_QUERY_KEY, (current) => {
        if (!current) {
          return {
            generatedAt: new Date().toISOString(),
            backups: [result.backup],
          };
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          backups: [result.backup, ...current.backups],
        };
      });
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: "Created backup snapshot.",
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: error.message,
          tone: "error",
        },
      ]);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: requestBackupRestore,
    onMutate: async (backupId) => {
      setRestoringBackupId(backupId);
      return { backupId };
    },
    onSuccess: () => {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: "Backup restore completed.",
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: error.message,
          tone: "error",
        },
      ]);
    },
    onSettled: () => {
      setRestoringBackupId(null);
    },
  });

  const data: BackupsDashboardData = useMemo(
    () => ({
      backups: query.data?.backups ?? [],
    }),
    [query.data?.backups],
  );

  function createBackup() {
    createMutation.mutate();
  }

  function restoreBackup(backupId: string) {
    restoreMutation.mutate(backupId);
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    toasts,
    error: query.error,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    isCreating: createMutation.isPending,
    restoringBackupId,
    createBackup,
    restoreBackup,
    dismissToast,
    refresh: query.refetch,
  };
}

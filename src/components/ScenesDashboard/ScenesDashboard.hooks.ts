import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Scene, ScenesResponse } from "../../../shared/contracts/scenes";
import {
  requestSceneActivation,
  requestSceneCreate,
  requestSceneDelete,
  requestSceneEdit,
  requestScenes,
} from "./ScenesDashboard.api";
import type { SceneDashboardData, SceneDraft, SceneFeedbackToast } from "./ScenesDashboard.types";
import { getInitialSceneDraft, sortScenesByName } from "./ScenesDashboard.utils";

const SCENES_QUERY_KEY = ["scenes-dashboard"] as const;

function replaceSceneById(scenes: Scene[], nextScene: Scene): Scene[] {
  return scenes.map((scene) => (scene.id === nextScene.id ? nextScene : scene));
}

export function useScenesDashboard() {
  const [draft, setDraft] = useState<SceneDraft>(getInitialSceneDraft);
  const [pendingSceneIds, setPendingSceneIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<SceneFeedbackToast[]>([]);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SCENES_QUERY_KEY,
    queryFn: requestScenes,
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: requestSceneCreate,
    onSuccess: (result) => {
      queryClient.setQueryData<ScenesResponse>(SCENES_QUERY_KEY, (current) => {
        if (!current) {
          return {
            generatedAt: new Date().toISOString(),
            scenes: [result.scene],
          };
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          scenes: sortScenesByName([...current.scenes, result.scene]),
        };
      });
      setDraft(getInitialSceneDraft());
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: `Created scene "${result.scene.name}".`,
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: error.message, tone: "error" },
      ]);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ sceneId, name }: { sceneId: string; name: string }) =>
      requestSceneEdit(sceneId, name),
    onMutate: async ({ sceneId }) => {
      setPendingSceneIds((current) =>
        current.includes(sceneId) ? current : [...current, sceneId],
      );
      return { sceneId };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ScenesResponse>(SCENES_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          scenes: sortScenesByName(replaceSceneById(current.scenes, result.scene)),
        };
      });
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: `Updated scene "${result.scene.name}".`,
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: error.message, tone: "error" },
      ]);
    },
    onSettled: (_data, _error, variables) => {
      setPendingSceneIds((current) => current.filter((sceneId) => sceneId !== variables.sceneId));
    },
  });

  const activateMutation = useMutation({
    mutationFn: requestSceneActivation,
    onMutate: async (sceneId) => {
      setPendingSceneIds((current) =>
        current.includes(sceneId) ? current : [...current, sceneId],
      );
      return { sceneId };
    },
    onSuccess: (result) => {
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: `Activated scene "${result.activatedSceneId}".`,
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: error.message, tone: "error" },
      ]);
    },
    onSettled: (_data, _error, sceneId) => {
      setPendingSceneIds((current) => current.filter((pendingId) => pendingId !== sceneId));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: requestSceneDelete,
    onMutate: async (sceneId) => {
      setPendingSceneIds((current) =>
        current.includes(sceneId) ? current : [...current, sceneId],
      );
      return { sceneId };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ScenesResponse>(SCENES_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          scenes: current.scenes.filter((scene) => scene.id !== result.deletedSceneId),
        };
      });
      setToasts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          message: `Deleted scene "${result.deletedSceneId}".`,
          tone: "success",
        },
      ]);
    },
    onError: (error) => {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: error.message, tone: "error" },
      ]);
    },
    onSettled: (_data, _error, sceneId) => {
      setPendingSceneIds((current) => current.filter((pendingId) => pendingId !== sceneId));
    },
  });

  const data: SceneDashboardData = useMemo(() => {
    const scenes = query.data?.scenes ?? [];
    return {
      scenes,
      sortedScenes: sortScenesByName(scenes),
    };
  }, [query.data?.scenes]);

  function createScene() {
    createMutation.mutate(draft);
  }

  function editScene(sceneId: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setToasts((current) => [
        ...current,
        { id: crypto.randomUUID(), message: "Scene name cannot be empty.", tone: "error" },
      ]);
      return;
    }

    editMutation.mutate({ sceneId, name: trimmedName });
  }

  function activateScene(sceneId: string) {
    activateMutation.mutate(sceneId);
  }

  function deleteScene(sceneId: string) {
    deleteMutation.mutate(sceneId);
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    draft,
    error: query.error,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    pendingSceneIds,
    toasts,
    createScene,
    editScene,
    activateScene,
    deleteScene,
    dismissToast,
    refresh: query.refetch,
    setDraft,
    creatingScene: createMutation.isPending,
  };
}

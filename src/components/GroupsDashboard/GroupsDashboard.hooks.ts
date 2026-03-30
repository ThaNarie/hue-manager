import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseGroupMutationRequest,
  parseGroupMutationResponse,
  parseGroupsResponse,
  type GroupsResponse,
} from "../../../shared/contracts/groups";
import type { Group } from "../../../shared/contracts/groups";
import type {
  GroupDraft,
  GroupErrorMap,
  GroupMutationInput,
  GroupsDashboardData,
  GroupsDashboardToast,
} from "./GroupsDashboard.types";
import {
  buildInitialGroupDrafts,
  hasGroupDraftChanges,
  replaceGroupById,
  toGroupDraft,
  toggleDraftMember,
} from "./GroupsDashboard.utils";

const GROUPS_QUERY_KEY = ["groups-dashboard"] as const;

async function requestGroups() {
  const response = await fetch("/api/groups");
  if (!response.ok) {
    throw new Error(`Groups endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseGroupsResponse(payload);
}

async function requestGroupMutation(input: GroupMutationInput) {
  const response = await fetch(
    `/api/groups/${encodeURIComponent(input.kind)}/${encodeURIComponent(input.hueGroupId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parseGroupMutationRequest(input.patch)),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Group update failed (${response.status})`;
    throw new Error(message);
  }

  return parseGroupMutationResponse(payload);
}

export function useGroupsDashboard() {
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({});
  const [groupErrors, setGroupErrors] = useState<GroupErrorMap>({});
  const [pendingGroupIds, setPendingGroupIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<GroupsDashboardToast[]>([]);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: requestGroups,
    staleTime: 10_000,
  });
  const mutation = useMutation({
    mutationFn: requestGroupMutation,
    onMutate: async (input) => {
      setGroupErrors((current) => {
        if (!current[input.groupId]) {
          return current;
        }
        const { [input.groupId]: _removed, ...rest } = current;
        return rest;
      });
      setPendingGroupIds((current) => {
        if (current.includes(input.groupId)) {
          return current;
        }
        return [...current, input.groupId];
      });
      return { groupId: input.groupId };
    },
    onSuccess: (result, input) => {
      queryClient.setQueryData<GroupsResponse>(GROUPS_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          groups: replaceGroupById(current.groups, result.group),
        };
      });
      setDrafts((current) => ({
        ...current,
        [input.groupId]: toGroupDraft(result.group),
      }));
    },
    onError: (error, _input, context) => {
      const groupId = context?.groupId;
      if (groupId) {
        setGroupErrors((current) => ({
          ...current,
          [groupId]: error.message,
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
    onSettled: (_data, _error, _input, context) => {
      const groupId = context?.groupId;
      if (!groupId) {
        return;
      }
      setPendingGroupIds((current) => current.filter((pendingId) => pendingId !== groupId));
    },
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }
    setDrafts(buildInitialGroupDrafts(query.data.groups));
  }, [query.data]);

  const data: GroupsDashboardData = useMemo(() => {
    if (!query.data) {
      return {
        groups: [],
        availableLights: [],
      };
    }

    return {
      groups: query.data.groups,
      availableLights: query.data.availableLights,
    };
  }, [query.data]);

  function updateGroupName(groupId: string, name: string) {
    setDrafts((current) => ({
      ...current,
      [groupId]: {
        ...(current[groupId] ?? { name: "", memberLightIds: [] }),
        name,
      },
    }));
  }

  function toggleGroupMembership(groupId: string, lightId: string) {
    setDrafts((current) => {
      const draft = current[groupId];
      if (!draft) {
        return current;
      }
      return {
        ...current,
        [groupId]: toggleDraftMember(draft, lightId),
      };
    });
  }

  function saveGroup(group: Group) {
    const draft = drafts[group.id];
    if (!draft) {
      return;
    }
    const trimmedName = draft.name.trim();
    const patch: GroupMutationInput["patch"] = {};
    if (trimmedName !== group.name) {
      patch.name = trimmedName;
    }
    if (hasGroupDraftChanges(group, draft)) {
      patch.memberLightIds = draft.memberLightIds;
    }
    if (patch.name === undefined && patch.memberLightIds === undefined) {
      return;
    }

    mutation.mutate({
      groupId: group.id,
      hueGroupId: group.hueGroupId,
      kind: group.kind,
      patch,
    });
  }

  function hasChanges(group: Group): boolean {
    const draft = drafts[group.id];
    if (!draft) {
      return false;
    }
    return hasGroupDraftChanges(group, draft);
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  return {
    ...data,
    drafts,
    groupErrors,
    pendingGroupIds,
    toasts,
    error: query.error,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    refresh: query.refetch,
    updateGroupName,
    toggleGroupMembership,
    saveGroup,
    hasChanges,
    dismissToast,
  };
}

import { useCallback } from "react";
import { QueryObserverResult, useMutation, useQuery, useQueryClient } from "react-query";

import { CloudWorkspacesService } from "packages/cloud/lib/domain/cloudWorkspaces/CloudWorkspacesService";
import { CloudWorkspace, CloudWorkspaceUsage, CreditStatus } from "packages/cloud/lib/domain/cloudWorkspaces/types";
import { useCurrentUser } from "packages/cloud/services/auth/AuthService";
import { useConfig } from "packages/cloud/services/config";
import { SCOPE_USER } from "services/Scope";
import { useDefaultRequestMiddlewares } from "services/useDefaultRequestMiddlewares";
import { useInitService } from "services/useInitService";

import { useSuspenseQuery } from "../../../../services/connector/useSuspenseQuery";

export const workspaceKeys = {
  all: [SCOPE_USER, "cloud_workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (filters: string) => [...workspaceKeys.lists(), { filters }] as const,
  details: () => [...workspaceKeys.all, "detail"] as const,
  detail: (id: number | string) => [...workspaceKeys.details(), id] as const,
  usage: (id: number | string) => [...workspaceKeys.details(), id, "usage"] as const,
};

function useGetWorkspaceService(): CloudWorkspacesService {
  const { cloudApiUrl } = useConfig();

  const requestAuthMiddleware = useDefaultRequestMiddlewares();

  return useInitService(
    () => new CloudWorkspacesService(cloudApiUrl, requestAuthMiddleware),
    [cloudApiUrl, requestAuthMiddleware]
  );
}

export function useListCloudWorkspaces(): CloudWorkspace[] {
  const service = useGetWorkspaceService();
  const user = useCurrentUser();

  return useSuspenseQuery<CloudWorkspace[]>(workspaceKeys.lists(), () => service.listByUser(user.userId));
}

export function useListCloudWorkspacesAsync(): QueryObserverResult<CloudWorkspace[]> {
  const service = useGetWorkspaceService();
  const user = useCurrentUser();

  return useQuery<CloudWorkspace[]>(workspaceKeys.lists(), () => service.listByUser(user.userId));
}

export function useCreateWorkspace() {
  const service = useGetWorkspaceService();
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  return useMutation(async (name: string) => service.create({ name, userId: user.userId }), {
    onSuccess: (result) => {
      queryClient.setQueryData<CloudWorkspace[]>(workspaceKeys.lists(), (old) => [...(old ?? []), result]);
    },
  }).mutateAsync;
}

export function useUpdateWorkspace() {
  const service = useGetWorkspaceService();
  const queryClient = useQueryClient();

  return useMutation(
    async (payload: { workspaceId: string; name: string }) =>
      service.update(payload.workspaceId, { name: payload.name }),
    {
      onSuccess: (result) => {
        queryClient.setQueryData<CloudWorkspace[]>(workspaceKeys.lists(), (old) => {
          const list = old ?? [];
          if (list.length === 0) {
            return [result];
          }

          const index = list.findIndex((item) => item.workspaceId === result.workspaceId);

          if (index === -1) {
            return list;
          }

          return [...list.slice(0, index), result, ...list.slice(index + 1)];
        });

        queryClient.setQueryData<CloudWorkspace>([workspaceKeys.detail(result.workspaceId)], (old) => {
          return {
            ...old,
            ...result,
          };
        });
      },
    }
  );
}

export function useRemoveWorkspace() {
  const service = useGetWorkspaceService();
  const queryClient = useQueryClient();

  return useMutation(async (workspaceId: string) => service.remove(workspaceId), {
    onSuccess: (_, workspaceId) => {
      queryClient.setQueryData<CloudWorkspace[] | undefined>(workspaceKeys.lists(), (old) =>
        old?.filter((workspace) => workspace.workspaceId !== workspaceId)
      );
    },
  });
}

export function useGetCloudWorkspace(workspaceId: string): CloudWorkspace {
  const service = useGetWorkspaceService();

  const workspace = useSuspenseQuery<CloudWorkspace>([workspaceKeys.detail(workspaceId)], () =>
    service.get(workspaceId)
  );
  if (workspace.name === "airbyte2") {
    workspace.creditStatus = CreditStatus.NEGATIVE_BEYOND_GRACE_PERIOD;
  }
  return workspace;
}

export function useInvalidateCloudWorkspace(workspaceId: string): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries([workspaceKeys.detail(workspaceId)]),
    [queryClient, workspaceId]
  );
}

export function useGetUsage(workspaceId: string): CloudWorkspaceUsage {
  const service = useGetWorkspaceService();

  return useSuspenseQuery<CloudWorkspaceUsage>([workspaceKeys.usage(workspaceId)], () => service.getUsage(workspaceId));
}

export { useWorkspaceService } from "services/workspaces/WorkspacesService";

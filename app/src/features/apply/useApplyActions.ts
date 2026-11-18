import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { errorCode, errorText } from '@/lib/errors'
import { notifyError, notifySuccess } from '@/lib/toast'
import { useSelectionStore } from '@/stores/selection'
import type { FolderItem, IconItem } from '@/types/api'

export interface ApplyVariables {
  icon: IconItem
  folder: FolderItem
}

/**
 * 应用/还原图标的唯一动作入口：
 * - 单例 mutation 放在 AppShell，快捷键、底部栏、右键菜单共用同一份 pending 状态；
 * - 成功后刷新文件夹列表（目录里的 Icon\r 变了），并让对应卡片脉冲一下。
 */
export function useApplyActions() {
  const queryClient = useQueryClient()
  const icon = useSelectionStore((state) => state.icon)
  const folder = useSelectionStore((state) => state.folder)
  const selectFolder = useSelectionStore((state) => state.selectFolder)
  const markApplied = useSelectionStore((state) => state.markApplied)

  const invalidateFolders = () =>
    queryClient.invalidateQueries({ queryKey: ['folders'] })

  const flashApplied = (path: string) => {
    markApplied(path)
    window.setTimeout(() => {
      useSelectionStore.getState().clearApplied()
    }, 1000)
  }

  const applyMutation = useMutation({
    mutationFn: ({ icon, folder }: ApplyVariables) =>
      api.applyIcon(icon.path, folder.path),
    onSuccess: (_, variables) => {
      notifySuccess(
        `已贴到「${variables.folder.name}」`,
        `换上了「${variables.icon.name}」`,
      )
      flashApplied(variables.folder.path)
      void invalidateFolders()
    },
    onError: (error, variables) => {
      const code = errorCode(error)
      if (code === 'not_found' || code === 'not_directory') {
        selectFolder(null)
      }
      notifyError(`没能贴到「${variables.folder.name}」`, errorText(error))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (target: FolderItem) => api.restoreIcon(target.path),
    onSuccess: (_, target) => {
      notifySuccess(`已还原「${target.name}」`, '文件夹图标恢复系统默认')
      flashApplied(target.path)
      void invalidateFolders()
    },
    onError: (error, target) => {
      const code = errorCode(error)
      if (code === 'not_found' || code === 'not_directory') {
        selectFolder(null)
      }
      notifyError(`没能还原「${target.name}」`, errorText(error))
    },
  })

  const applyTo = (target?: FolderItem) => {
    const folderTarget = target ?? folder
    if (!icon || !folderTarget || applyMutation.isPending) return
    applyMutation.mutate({ icon, folder: folderTarget })
  }

  const restoreOn = (target?: FolderItem) => {
    const folderTarget = target ?? folder
    if (!folderTarget || restoreMutation.isPending) return
    restoreMutation.mutate(folderTarget)
  }

  return {
    icon,
    folder,
    canApply: Boolean(icon && folder),
    canRestore: Boolean(folder),
    isApplying: applyMutation.isPending,
    isRestoring: restoreMutation.isPending,
    apply: () => applyTo(),
    applyTo,
    restore: () => restoreOn(),
    restoreOn,
  }
}

export type ApplyActions = ReturnType<typeof useApplyActions>

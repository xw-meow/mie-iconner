import { useQuery } from '@tanstack/react-query'

import { api, assetUrl } from '@/lib/api'
import type { ThumbKind } from '@/types/api'

/**
 * 按需拿一张缩略图。缓存 key 里带文件版本号：
 * 导入覆盖、应用图标后版本变化 → 自动重新生成，无需手动清缓存。
 */
export function useThumbnail({
  path,
  kind,
  version,
  enabled = true,
}: {
  path: string
  kind: ThumbKind
  version: number | null
  enabled?: boolean
}) {
  return useQuery({
    queryKey: ['thumbnail', kind, path, version],
    queryFn: () => api.thumbnail(path, kind, version ?? 0).then(assetUrl),
    enabled: enabled && Boolean(path) && version !== null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  })
}

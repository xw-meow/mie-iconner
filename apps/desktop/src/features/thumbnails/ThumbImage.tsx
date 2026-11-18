import { ImageOff } from 'lucide-react'

import { Skeleton } from '@/components/ui/Skeleton'
import { useThumbnail } from '@/features/thumbnails/useThumbnail'
import { cn } from '@/lib/cn'
import type { ThumbKind } from '@/types/api'

interface ThumbImageProps {
  path: string
  kind: ThumbKind
  version: number | null
  alt: string
  className?: string
  /** 加载中/失败时显示的占位（如文件夹图形）；不传则显示 shimmer */
  placeholder?: React.ReactNode
  enabled?: boolean
}

export function ThumbImage({
  path,
  kind,
  version,
  alt,
  className,
  placeholder,
  enabled = true,
}: ThumbImageProps) {
  const { data, isLoading, isError } = useThumbnail({ path, kind, version, enabled })

  if (data) {
    return (
      <img
        src={data}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={cn('animate-fade-in object-contain', className)}
      />
    )
  }

  if (isLoading && !isError) {
    return placeholder ? (
      <>{placeholder}</>
    ) : (
      <Skeleton className={cn('size-full rounded-[8px]', className)} />
    )
  }

  if (placeholder) return <>{placeholder}</>

  return (
    <span
      className={cn(
        'flex items-center justify-center text-ink-3/70',
        className,
      )}
    >
      <ImageOff className="size-5" strokeWidth={1.5} />
    </span>
  )
}

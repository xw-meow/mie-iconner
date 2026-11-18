import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/Button'

interface BootSplashProps {
  error?: string | null
  onRetry?: () => void
}

/** 启动校验当前目录期间的过渡页，同时承担启动失败兜底 */
export function BootSplash({ error, onRetry }: BootSplashProps) {
  return (
    <div className="app-canvas flex h-full flex-col items-center justify-center">
      <div className="flex flex-col items-center">
        <img
          src="/app-icon.png"
          alt="小羊贴纸铺"
          className="size-[92px] rounded-[22px] shadow-[0_20px_42px_-20px_rgb(122_92_62_/_0.65)] animate-pop-in"
          draggable={false}
        />
        <h1 className="mt-5 font-rounded text-[21px] font-bold tracking-[-0.01em] text-ink">
          小羊贴纸铺
        </h1>

        {error ? (
          <div className="mt-3 flex max-w-[300px] flex-col items-center">
            <p className="flex items-center gap-1.5 text-[12px] text-danger">
              <AlertCircle className="size-3.5" />
              启动失败
            </p>
            <p className="mt-1 text-center text-[11px] leading-5 text-ink-3">
              {error}
            </p>
            {onRetry ? (
              <Button className="mt-3" size="sm" onClick={onRetry}>
                重试
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-[12px] text-ink-3">正在铺开贴纸…</p>
            <div className="mt-4 flex items-center gap-1">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="size-1.5 rounded-full bg-brand/70 animate-pulse-soft"
                  style={{ animationDelay: `${index * 160}ms` }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

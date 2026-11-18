import { ExternalLink, Heart } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DialogShell } from '@/components/ui/Dialog'
import { useEnvQuery } from '@/features/queries'
import { openExternal } from '@/lib/system'
import { useUIStore } from '@/stores/ui'

const REPO_URL = 'https://github.com/xw-meow/mie-iconner'

export function AboutDialog() {
  const open = useUIStore((state) => state.aboutOpen)
  const setOpen = useUIStore((state) => state.setAboutOpen)
  const { data: env } = useEnvQuery()

  return (
    <DialogShell
      open={open}
      onOpenChange={setOpen}
      title="小羊贴纸铺"
      description="把喜欢的贴纸贴到文件夹上。"
      className="max-w-[380px]"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => void openExternal(REPO_URL)}
          >
            <ExternalLink className="size-3.5" />
            GitHub
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            好
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <img
          src="/app-icon.png"
          alt="小羊贴纸铺"
          className="size-[72px] rounded-[18px] shadow-[0_12px_28px_-14px_rgb(122_92_62_/_0.6)]"
          draggable={false}
        />
        <div className="mt-3 flex items-center gap-1.5">
          <span className="rounded-full bg-slot px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-ink-2">
            v{env?.version ?? '2.0.0'}
          </span>
          <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10.5px] font-medium text-brand">
            免费开源
          </span>
        </div>
        <p className="mt-3 max-w-[280px] text-[11.5px] leading-5 text-ink-3">
          内置贴纸版权归原画师所有。应用不上传、不收集任何数据，
          你的图片和文件夹都只留在本机。
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-ink-3">
          用 <Heart className="size-3 text-brand" /> 做给 macOS
        </p>
      </div>
    </DialogShell>
  )
}

/**
 * 通用文件夹图形：没有自定义图标时占位。
 * 暖金色调与「暖纸贴纸册」主题一致，比系统蓝色文件夹更融入画布。
 */
export function FolderGlyph({
  className,
  size = 56,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="folder-tab" x1="12" y1="8" x2="40" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8D28A" />
          <stop offset="1" stopColor="#E9AC55" />
        </linearGradient>
        <linearGradient id="folder-front" x1="10" y1="22" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBDC9D" />
          <stop offset="1" stopColor="#EDB45F" />
        </linearGradient>
        <linearGradient id="folder-shine" x1="10" y1="24" x2="30" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 背板与标签 */}
      <path
        d="M7 17.5C7 14.46 9.46 12 12.5 12h13.2c1.4 0 2.73.56 3.7 1.56L32.6 17H51.5c3.04 0 5.5 2.46 5.5 5.5V23H7v-5.5Z"
        fill="url(#folder-tab)"
      />
      {/* 前板 */}
      <path
        d="M7 22.5c0-3.04 2.46-5.5 5.5-5.5h39c3.04 0 5.5 2.46 5.5 5.5V48c0 4.42-3.58 8-8 8H15c-4.42 0-8-3.58-8-8V22.5Z"
        fill="url(#folder-front)"
      />
      {/* 左上高光 */}
      <path
        d="M12.5 22h39c1.93 0 3.5 1.57 3.5 3.5V31H9v-5.5c0-1.93 1.57-3.5 3.5-3.5Z"
        fill="url(#folder-shine)"
      />
      {/* 纸张边缘 */}
      <path
        d="M15 25.5h34.5"
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 底部投影线 */}
      <path
        d="M13 53.5c2.6 1.6 5.9 2.5 9.5 2.5h19c3.6 0 6.9-.9 9.5-2.5"
        stroke="#C98E3E"
        strokeOpacity="0.28"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 小尺寸的文件夹图标，用于输入框/面包屑 */
export function FolderMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M2.5 5.5c0-1.1.9-2 2-2h3.3c.55 0 1.07.22 1.46.61l.9.9h5.34c1.1 0 2 .9 2 2v6.5c0 1.1-.9 2-2 2H4.5c-1.1 0-2-.9-2-2V5.5Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path
        d="M2.5 7.5h15v5.5c0 1.1-.9 2-2 2H4.5c-1.1 0-2-.9-2-2V7.5Z"
        fill="currentColor"
        fillOpacity="0.34"
      />
    </svg>
  )
}

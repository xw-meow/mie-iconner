export type IconSource = 'bundled' | 'custom'
export type ThumbKind = 'image' | 'folder'

export interface IconItem {
  path: string
  name: string
  source: IconSource
  /** 文件 mtime + 长度的混合版本号，用于缩略图缓存失效 */
  modified: number
}

export interface CategoryConfig {
  priority: number
  author: string | null
  authorUrl: string | null
  brandName: string | null
  brandColor: string | null
  defaultExpanded: boolean
}

export interface Category {
  name: string
  icons: IconItem[]
  config: CategoryConfig
}

export interface LibrarySnapshot {
  bundled: Category[]
  custom: Category[]
}

export interface FolderItem {
  path: string
  name: string
  hasCustomIcon: boolean
  iconModified: number | null
}

export interface PathSuggestion {
  path: string
  name: string
  display: string
}

export interface ResolvedPath {
  path: string
  name: string
  display: string
}

export interface EnvInfo {
  home: string
  desktop: string
  version: string
  customIconsDir: string
}

export interface ImportFailure {
  path: string
  reason: string
}

export interface ImportReport {
  imported: IconItem[]
  failed: ImportFailure[]
}

/** Rust AppError 的序列化形态 */
export interface AppError {
  code: string
  message: string
}

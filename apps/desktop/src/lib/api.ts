import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type {
  EnvInfo,
  FolderItem,
  ImportReport,
  LibrarySnapshot,
  PathSuggestion,
  ResolvedPath,
  ThumbKind,
} from '@/types/api'

/**
 * 与 Rust command 层一一对应的类型化薄封装。
 * 组件不直接拼 invoke 字符串，命令改名/改参数时只需要改这里。
 */
export const api = {
  env: () => invoke<EnvInfo>('get_env'),

  resolvePath: (input: string) =>
    invoke<ResolvedPath | null>('resolve_path', { input }),

  suggestPaths: (input: string, limit = 8) =>
    invoke<PathSuggestion[]>('suggest_paths', { input, limit }),

  library: () => invoke<LibrarySnapshot>('list_library'),

  folders: (path: string) => invoke<FolderItem[]>('list_folders', { path }),

  applyIcon: (iconPath: string, folderPath: string) =>
    invoke<void>('apply_icon', { iconPath, folderPath }),

  restoreIcon: (folderPath: string) =>
    invoke<void>('restore_icon', { folderPath }),

  thumbnail: (path: string, kind: ThumbKind, version: number) =>
    invoke<string>('thumbnail', { path, kind, version }),

  importIcons: (paths: string[], category: string) =>
    invoke<ImportReport>('import_icons', { paths, category }),

  createCategory: (name: string) => invoke<string>('create_category', { name }),

  deleteIcon: (path: string) => invoke<void>('delete_icon', { path }),

  deleteCategory: (name: string) =>
    invoke<void>('delete_category', { name }),

  restartFinder: () => invoke<void>('restart_finder'),
} as const

/** 把后端返回的缓存文件路径变成 webview 可加载的 asset:// URL */
export function assetUrl(path: string): string {
  return convertFileSrc(path)
}

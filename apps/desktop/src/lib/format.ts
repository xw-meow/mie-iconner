export interface Breadcrumb {
  label: string
  path: string
  kind: 'home' | 'root' | 'folder'
}

/** 把绝对路径拆成可点击的面包屑；家目录显示为「个人」 */
export function buildBreadcrumbs(path: string, home: string): Breadcrumb[] {
  if (!path) return []
  const normalizedHome = home.replace(/\/+$/, '')
  if (path === normalizedHome) {
    return [{ label: '个人', path, kind: 'home' }]
  }

  const crumbs: Breadcrumb[] = []
  let rest: string
  if (path.startsWith(`${normalizedHome}/`)) {
    crumbs.push({ label: '个人', path: normalizedHome, kind: 'home' })
    rest = path.slice(normalizedHome.length + 1)
  } else {
    crumbs.push({ label: '/', path: '/', kind: 'root' })
    rest = path.replace(/^\/+/, '')
  }

  let current = crumbs[0].path === '/' ? '' : crumbs[0].path
  for (const segment of rest.split('/').filter(Boolean)) {
    current = current === '/' ? `/${segment}` : `${current}/${segment}`
    crumbs.push({ label: segment, path: current, kind: 'folder' })
  }
  return crumbs
}

/** 家目录前缀缩写为 ~，与后端 display_path 保持一致 */
export function displayPath(path: string, home: string): string {
  if (!path) return ''
  if (path === home) return '~'
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`
  return path
}

/** 路径最后一段 */
export function pathName(path: string): string {
  if (path === '/') return '/'
  return path.split('/').filter(Boolean).at(-1) ?? path
}

/** 校验 config.json 里可能出现的任意颜色值，非法时回退 */
export function safeHexColor(value: string | null | undefined, fallback = '#0958d9'): string {
  if (!value) return fallback
  const hex = value.startsWith('#') ? value.slice(1) : value
  if (![3, 6].includes(hex.length)) return fallback
  return /^[0-9a-f]+$/i.test(hex) ? `#${hex}` : fallback
}

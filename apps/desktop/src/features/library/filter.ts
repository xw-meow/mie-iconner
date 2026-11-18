import type { Category } from '@/types/api'

export interface FilterResult {
  categories: Category[]
  /** 命中分类数 */
  categoryCount: number
  /** 命中贴纸数 */
  iconCount: number
}

/**
 * 贴纸搜索：
 * - 查询词命中分类名时，保留该分类全部贴纸；
 * - 否则按贴纸名过滤；
 * - 空分类在搜索态下隐藏，避免一屏空白分区。
 */
export function filterCategories(
  categories: Category[],
  query: string,
): FilterResult {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return {
      categories,
      categoryCount: categories.length,
      iconCount: categories.reduce((sum, category) => sum + category.icons.length, 0),
    }
  }

  const matched: Category[] = []
  let iconCount = 0
  for (const category of categories) {
    const categoryHit = category.name.toLowerCase().includes(needle)
    const icons = categoryHit
      ? category.icons
      : category.icons.filter((icon) =>
          icon.name.toLowerCase().includes(needle),
        )
    if (icons.length === 0) continue
    iconCount += icons.length
    matched.push({ ...category, icons })
  }

  return {
    categories: matched,
    categoryCount: matched.length,
    iconCount,
  }
}

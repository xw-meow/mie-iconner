import { describe, expect, it } from 'vitest'

import { filterCategories } from '@/features/library/filter'
import type { Category, IconItem } from '@/types/api'

function icon(name: string, source: IconItem['source'] = 'bundled'): IconItem {
  return {
    path: `/icons/${name}.png`,
    name,
    source,
    modified: 1,
  }
}

function category(
  name: string,
  icons: IconItem[],
  defaultExpanded = true,
): Category {
  return {
    name,
    icons,
    config: {
      priority: 0,
      author: null,
      authorUrl: null,
      brandName: null,
      brandColor: null,
      defaultExpanded,
    },
  }
}

const categories = [
  category('动物', [icon('狐狸'), icon('猫头鹰')]),
  category('职业', [icon('厨师'), icon('警察')]),
  category('空的', []),
]

describe('filterCategories', () => {
  it('returns the original list and totals for empty query', () => {
    const result = filterCategories(categories, '   ')
    expect(result.categories).toBe(categories)
    expect(result.categoryCount).toBe(3)
    expect(result.iconCount).toBe(4)
  })

  it('filters icons by name case-insensitively', () => {
    const result = filterCategories(categories, '猫')
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].icons.map((item) => item.name)).toEqual(['猫头鹰'])
    expect(result.iconCount).toBe(1)
  })

  it('keeps all icons of a category when the category name matches', () => {
    const result = filterCategories(categories, '职业')
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].icons).toHaveLength(2)
  })

  it('hides empty categories while searching', () => {
    const result = filterCategories(categories, '厨')
    expect(result.categories.map((item) => item.name)).toEqual(['职业'])
    expect(result.categories[0].icons.map((item) => item.name)).toEqual(['厨师'])
  })

  it('returns no categories when nothing matches', () => {
    const result = filterCategories(categories, '不存在')
    expect(result.categories).toEqual([])
    expect(result.iconCount).toBe(0)
  })
})

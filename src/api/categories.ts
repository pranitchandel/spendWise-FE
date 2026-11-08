import { api, unwrap } from './client'
import type { Category, CategoryType, Paginated } from '@/types'

export interface CategoryInput {
  name: string
  type: CategoryType
  icon?: string
  color?: string
}
export const categoriesApi = {
  list(params: { type?: CategoryType; includeArchived?: boolean; page?: number; limit?: number } = {}) {
    return unwrap<Category[] | Paginated<Category>>(api.get('/categories', { params: { page: 1, limit: 100, ...params } })).then((data) =>
      Array.isArray(data) ? data : data.items,
    )
  },

  listPage(params: { type?: CategoryType; includeArchived?: boolean; page: number; limit: number }) {
    return unwrap<Paginated<Category>>(api.get('/categories', { params }))
  },

  create(input: CategoryInput) {
    return unwrap<Category>(api.post('/categories', input))
  },

  update(id: string, input: Partial<CategoryInput> & { isArchived?: boolean }) {
    return unwrap<Category>(api.put(`/categories/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ id: string } | void>(api.delete(`/categories/${id}`))
  },
}

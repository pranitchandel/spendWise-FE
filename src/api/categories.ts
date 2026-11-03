import { api, unwrap } from './client'
import type { Category, CategoryType } from '@/types'

export interface CategoryInput {
  name: string
  type: CategoryType
  icon?: string
  color?: string
}

export const categoriesApi = {
  list(params?: { type?: CategoryType; includeArchived?: boolean }) {
    return unwrap<Category[]>(api.get('/categories', { params })).then((data) =>
      Array.isArray(data) ? data : [],
    )
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
  
  permanentlyDelete(id: string) {
    return unwrap<{ id: string }>(api.delete(`/categories/${id}/permanent`))
  },
}

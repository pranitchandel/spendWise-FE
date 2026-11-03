import { api, unwrap } from './client'
import type { Person } from '@/types'

export interface PersonInput {
  name: string
  phone?: string
  email?: string
  notes?: string
}

export const peopleApi = {
  list() {
    return unwrap<Person[]>(api.get('/people')).then((data) => (Array.isArray(data) ? data : []))
  },

  create(input: PersonInput) {
    return unwrap<Person>(api.post('/people', input))
  },

  update(id: string, input: Partial<PersonInput> & { isArchived?: boolean }) {
    return unwrap<Person>(api.put(`/people/${id}`, input))
  },
}

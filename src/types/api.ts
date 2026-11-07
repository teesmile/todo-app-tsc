export interface Todo {
  id: number
  todo: string
  completed: boolean
  userId: number
  _meta?: {
    isLocal: boolean
    isSynced: boolean
    createdAt: Date
    updatedAt: Date
  }
}

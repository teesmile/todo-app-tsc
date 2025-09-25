export interface Todo {
  id: number;
  todo: string;
  completed: boolean;
  userId: number;
  _meta?: {
    isLocal: boolean;
    isSynced: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface TodoResponse {
  todos: Todo[];
  total: number;
  skip: number;
  limit: number;
}
// Todo app type definitions
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface TodoFormData {
  title: string;
}

export type TodoFilter = 'all' | 'active' | 'completed';
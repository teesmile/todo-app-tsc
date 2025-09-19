// Todo Types
export interface Todo {
  id: number;
  todo: string;
  completed: boolean;
  userId: number;
}

export interface TodosResponse {
  todos: Todo[];
  meta: {
    totalPages: number;
    currentPage: number;
    rootUrl: string;
  };
  total: number;
  page: number;
  skip: number;
  limit: number;
}

// Auth Types
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  image: string;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AddTodoPayload {
  todo: string;
  completed: boolean;
  userId: number;
}
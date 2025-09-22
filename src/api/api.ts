import { api } from "./api-client";
import { Todo, TodosResponse, User, LoginCredentials, AddTodoPayload } from "@/types/api";


//Todo Api
export const fetchTodos = async (params: {limit: number; skip: number}): Promise<TodosResponse> => {
    return api.get('/todos', {params});
};
export const fetchTodo = async (todoId: number): Promise<Todo> => {
    return api.get(`/todos/${todoId}`);
}

export const addTodo = async (newTodo: AddTodoPayload): Promise<Todo> => {
    return api.post('/todos/add', newTodo);
};

export const updateTodo = async (todoId: number, updatedTodo: Partial<AddTodoPayload>): Promise<TodosResponse> => {
    return api.put(`/todos/${todoId}`, updatedTodo);
}

export const deleteTodo = async (todoId: number): Promise<AddTodoPayload> => {
    return api.delete(`/todos/${todoId}`);
};

//Auth Api
export const login = async (credentials: LoginCredentials): Promise<User> => {
    return api.post('/auth/login', credentials);
};



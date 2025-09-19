import { api } from "./api-client";
import { Todo, TodosResponse, User, LoginCredentials, AddTodoPayload } from "@/types/api";


//Todo Api
export const fetchTodos = async (params: {limit: number; skip: number}): Promise<TodosResponse> => {
    return api.get('/todos', {params});
};

export const addTodo = async (newTodo: AddTodoPayload): Promise<Todo> => {
    return api.post('/todos/add', newTodo);
};

//Auth Api
export const login = async (credentials: LoginCredentials): Promise<User> => {
    return api.post('/auth/login', credentials);
};



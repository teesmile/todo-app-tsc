import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import { fetchTodos, addTodo, updateTodo, deleteTodo } from '@/api/api';
import { AddTodoPayload } from '@/types/api';

export const useTodos = (params: {limit: number; skip: number}) => {
    return useQuery( {
        queryKey: ['todos', params],
        queryFn: () => fetchTodos(params),
        placeholderData: (prev) => prev,
    });
}

export const useAddTodo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: addTodo,
        onSuccess: () => {
            queryClient.invalidateQueries(
                { queryKey: ['todos'] }
            );
        },
    });
};


export const useUpdateTodo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({id, ...updateData}: {id: number} & Partial<AddTodoPayload>) => {
            return updateTodo(id, updateData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(
                { queryKey: ['todos'] }
            );
        },
    });
};

export const useDeleteTodo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteTodo,
        onSuccess: () => {
            queryClient.invalidateQueries(
                { queryKey: ['todos'] }
            );
        },
    });
};
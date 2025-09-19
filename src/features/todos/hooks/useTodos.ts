import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import { fetchTodos, addTodo } from '@/api/api';


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
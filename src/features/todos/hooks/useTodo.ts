import { useQuery } from '@tanstack/react-query';
import { fetchTodo } from '@/api/api';

export const useTodo = (todoId: number) => {
    return useQuery({
        queryKey: ['todo', todoId],
        queryFn: () => fetchTodo(todoId),
        enabled: !!todoId, 
    });
};
'use client';

import { Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { useNotifications } from '@/components/ui/notifications';
import { useUser } from '@/lib/auth';
import { canDeleteTodo } from '@/lib/authorization';

import { useDeleteTodo } from '../api/delete-todo';

type DeleteTodoProps = {
  id: string;
};

export const DeleteTodo = ({ id }: DeleteTodoProps) => {
  const user = useUser();
  const { addNotification } = useNotifications();
  const deleteTodoMutation = useDeleteTodo({
    mutationConfig: {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Todo Deleted',
        });
      },
    },
  });

  if (!canDeleteTodo(user?.data)) {
    return null;
  }

  return (
    <ConfirmationDialog
      icon="danger"
      title="Delete Todo"
      body="Are you sure you want to delete this todo?"
      triggerButton={
        <Button variant="destructive" icon={<Trash className="size-4" />}>
          Delete Todo
        </Button>
      }
      confirmButton={
        <Button
          isLoading={deleteTodoMutation.isPending}
          type="button"
          variant="destructive"
          onClick={() => deleteTodoMutation.mutate({ todoId: id })}
        >
          Delete Todo
        </Button>
      }
    />
  );
};
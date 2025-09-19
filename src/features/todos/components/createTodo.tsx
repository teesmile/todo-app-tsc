'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormDrawer,
  Input,
  Switch,
  Label,
} from '@/components/ui/form';
import { useNotifications } from '@/components/ui/notifications';
import { useUser } from '@/lib/auth';
import { canCreateTodo } from '@/lib/authorization';

import {
  createTodoInputSchema,
  useCreateTodo,
} from '../api/create-todo';

export  const CreateTodo = () => {
  const { addNotification } = useNotifications();
  const createTodoMutation = useCreateTodo({
    mutationConfig: {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Todo Created',
        });
      },
    },
  });

  const user = useUser();

  if (!canCreateTodo(user?.data)) {
    return null;
  }

  return (
    <FormDrawer
      isDone={createTodoMutation.isSuccess}
      triggerButton={
        <Button size="sm" icon={<Plus className="size-4" />}>
          Create Todo
        </Button>
      }
      title="Create Todo"
      submitButton={
        <Button
          form="create-todo"
          type="submit"
          size="sm"
          isLoading={createTodoMutation.isPending}
        >
          Submit
        </Button>
      }
    >
      <Form
        id="create-todo"
        onSubmit={(values) => {
          createTodoMutation.mutate({ data: values });
        }}
        schema={createTodoInputSchema}
        options={{
          defaultValues: {
            todo: '',
            completed: false,
          },
        }}
      >
        {({ register, formState, setValue, watch }) => (
          <>
            <Input
              label="Todo"
              error={formState.errors['todo']}
              registration={register('todo')}
            />

            <div className="flex items-center space-x-2">
              <Switch
                name="completed"
                onCheckedChange={(value) => setValue('completed', value)}
                checked={watch('completed')}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                id="completed"
              />
              <Label htmlFor="completed">Completed</Label>
            </div>
          </>
        )}
      </Form>
    </FormDrawer>
  );
};
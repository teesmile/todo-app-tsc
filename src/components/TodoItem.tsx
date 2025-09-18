import { Todo } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
      />
      <span
        className={`flex-1 ${
          todo.completed
            ? 'line-through text-gray-500'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {todo.title}
      </span>
      <span className="text-xs text-gray-400">
        {todo.createdAt.toLocaleDateString()}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        Delete
      </button>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useAddTodo } from '../hooks/useTodos';

interface AddTodoFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AddTodoForm = ({ onSuccess, onCancel }: AddTodoFormProps) => {
  const [todo, setTodo] = useState('');
  const [completed, setCompleted] = useState(false);
  
  const addTodoMutation = useAddTodo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todo.trim()) return;
    
    addTodoMutation.mutate({
      todo: todo.trim(),
      completed,
      userId: 1,
    }, {
      onSuccess: () => {
        setTodo('');
        setCompleted(false);
        onSuccess?.();
      }
    });
  };

  const handleCancel = () => {
    setTodo('');
    setCompleted(false);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Todo Description
        </label>
        <textarea
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          rows={3}
          placeholder="Enter your todo description..."
          required
          autoFocus
        />
      </div>
      
      <div className="mb-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="w-4 h-4 text-white bg-orange-500 border-none rounded focus:ring-orange-500 accent-orange-500"
          />
          <span className="text-sm text-gray-700">Mark as completed</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={addTodoMutation.isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
          disabled={addTodoMutation.isPending || !todo.trim()}
        >
          {addTodoMutation.isPending ? 'Creating...' : 'Create Todo'}
        </button>
      </div>
    </form>
  );
};
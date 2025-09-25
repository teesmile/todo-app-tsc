'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useUpdateTodo } from '../hooks/useTodos';
import { Todo } from '@/types/api';

interface EditTodoFormProps {
  todo: Todo;
  onSave: () => void;
  onCancel: () => void;
}

export const EditTodoForm = ({ todo, onSave, onCancel }: EditTodoFormProps) => {
  const [editText, setEditText] = useState(todo.todo);
  const updateTodoMutation = useUpdateTodo();

  const handleSave = async () => {
    if (!editText.trim()) return;
    
    try {
      await updateTodoMutation.mutateAsync({
        id: todo.id,
        todo: editText.trim()
      });
      onSave();
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleCancel = () => {
    setEditText(todo.todo);
    onCancel();
  };

  return (
    <div className="mb-2">
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
          if (e.key === 'Escape') {
            handleCancel();
          }
        }}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50"
          disabled={updateTodoMutation.isPending || !editText.trim()}
        >
          <Check className="w-3 h-3" />
          {updateTodoMutation.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1 px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
        >
          <X className="w-3 h-3 text-orange-500" />
          Cancel
        </button>
      </div>
    </div>
  );
};
'use client';

import { useState } from 'react';
import { Edit2, Check, X, Eye } from 'lucide-react';
import Link from 'next/link';
import { Todo } from "@/types/api";
import { useUpdateTodo } from '../hooks/useTodos';

interface TodoItemProps {
  todo: Todo;
  showActions?: boolean;
}

const TodoItem = ({ todo, showActions = true }: TodoItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.todo);
  
  const updateTodoMutation = useUpdateTodo();

  const handleToggleComplete = () => {
    updateTodoMutation.mutate({
      id: todo.id,
      completed: !todo.completed
    });
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    
    updateTodoMutation.mutate({
      id: todo.id,
      todo: editText.trim()
    });
    
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(todo.todo);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      {/* Completion Toggle */}
      <button
        onClick={handleToggleComplete}
        disabled={updateTodoMutation.isPending}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          todo.completed 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-gray-300 hover:border-green-400'
        }`}
      >
        {todo.completed && '✓'}
      </button>

      {/* Todo Text */}
      <div className="flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            autoFocus
          />
        ) : (
          <Link 
            href={`/todos/${todo.id}`}
            className="block hover:text-blue-600 transition-colors cursor-pointer"
          >
            <span className={`${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
              {todo.todo}
            </span>
          </Link>
        )}
      </div>

      {/* Edit Actions */}
      {showActions && (
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="p-1 text-green-600 hover:text-green-700"
                disabled={updateTodoMutation.isPending}
                title="Save changes"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-gray-600 hover:text-gray-700"
                title="Cancel editing"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/todos/${todo.id}`}
                className="p-1 text-indigo-600 hover:text-indigo-700"
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-blue-600 hover:text-blue-700"
                title="Edit todo"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Status Badge */}
      <div className="text-xs">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          todo.completed 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {todo.completed ? 'Done' : 'Pending'}
        </span>
      </div>
    </div>
  );
};

export default TodoItem;
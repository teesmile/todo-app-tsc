'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Check, X } from 'lucide-react';
import { useTodo } from '../hooks/useTodo';
import { useUpdateTodo } from '../hooks/useTodos';
import { DeleteTodo } from './deleteTodo';

interface TodoDetailProps {
  todoId: number;
}

export const TodoDetail = ({ todoId }: TodoDetailProps) => {
  const router = useRouter();
  
  // Add editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  
  const { data: todo, isLoading, error } = useTodo(todoId);
  const updateTodoMutation = useUpdateTodo();

  // Edit functions
  const startEditing = () => {
    if (todo) {
      setIsEditing(true);
      setEditText(todo.todo);
    }
  };

  const saveEdit = async () => {
    if (!editText.trim() || !todo) return;
    
    try {
      await updateTodoMutation.mutateAsync({
        id: todo.id,
        todo: editText.trim()
      });
      setIsEditing(false);
      setEditText('');
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading todo...</p>
        </div>
      </div>
    );
  }

  if (error || !todo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Todo Not Found</h1>
          <p className="text-gray-600 mt-2">The todo you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Todo Details</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-8">
            {/* Todo Status */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-4 h-4 rounded-full ${
                todo.completed ? 'bg-green-500' : 'bg-orange-400'
              }`} />
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                todo.completed 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {todo.completed ? 'Completed' : 'In Progress'}
              </span>
            </div>

            {/* Todo Content - Editable */}
            <div className="mb-8">
              {isEditing ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Todo Description
                  </label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    rows={3}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      }
                      if (e.key === 'Escape') {
                        cancelEdit();
                      }
                    }}
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={saveEdit}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                      disabled={updateTodoMutation.isPending || !editText.trim()}
                    >
                      <Check className="w-4 h-4" />
                      {updateTodoMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {todo.todo}
                    </h2>
                  </div>
                  
                </div>
              )}
              
              {/* Details Grid - Only show when not editing */}
              {!isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <p className="text-gray-900">
                      {todo.completed ? 'Completed' : 'Not Started'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User ID
                    </label>
                    <p className="text-gray-900">{todo.userId}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Todo ID
                    </label>
                    <p className="text-gray-900">{todo.id}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <p className="text-gray-900">Moderate</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Only show when not editing */}
            {!isEditing && (
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Todo
                </button>
                
                <DeleteTodo id={todo.id.toString()} />
                
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
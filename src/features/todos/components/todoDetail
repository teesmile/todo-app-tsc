'use client';

import { useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Check, X, Calendar, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTodo } from '../hooks/useTodo';
import { useUpdateTodo, useDeleteTodo } from '../hooks/useTodos';
import { Todo } from '@/types/api';

interface TodoDetailProps {
  todoId: number;
}

export const TodoDetail = ({ todoId }: TodoDetailProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const router = useRouter();
  const todoQuery = useTodo(todoId);
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();

  const todo = todoQuery.data;

  // Initialize edit text when todo loads
  useState(() => {
    if (todo && !editText) {
      setEditText(todo.todo);
    }
  }, [todo]);

  const handleToggleComplete = () => {
    if (!todo) return;
    
    updateTodoMutation.mutate({
      id: todo.id,
      completed: !todo.completed
    });
  };

  const handleStartEdit = () => {
    if (todo) {
      setEditText(todo.todo);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (!todo || !editText.trim()) return;
    
    updateTodoMutation.mutate({
      id: todo.id,
      todo: editText.trim()
    });
    
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (todo) {
      setEditText(todo.todo);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!todo) return;
    
    try {
      await deleteTodoMutation.mutateAsync(todo.id);
      router.push('/'); // Redirect to home after delete
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  if (todoQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (todoQuery.error || !todo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Todo Not Found</h1>
          <p className="text-gray-600 mb-4">The todo you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Todos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
          
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Todo Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        {/* Status */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleToggleComplete}
            disabled={updateTodoMutation.isPending}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              todo.completed 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            } hover:opacity-80 transition-opacity`}
          >
            <div className={`w-3 h-3 rounded-full ${
              todo.completed ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            {todo.completed ? 'Completed' : 'Pending'}
          </button>

          <span className="text-sm text-gray-500">ID: {todo.id}</span>
        </div>

        {/* Todo Content */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Todo Description
          </label>
          
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Enter todo description..."
              />
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={updateTodoMutation.isPending || !editText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {updateTodoMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-lg leading-relaxed ${
              todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
            }`}>
              {todo.todo}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">User ID</p>
                <p className="text-sm text-gray-500">{todo.userId}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <p className="text-sm text-gray-500">
                  {todo.completed ? 'Completed' : 'In Progress'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <div className="text-center">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Delete Todo</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this todo? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteTodoMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteTodoMutation.isPending ? 'Deleting...' : 'Delete Todo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
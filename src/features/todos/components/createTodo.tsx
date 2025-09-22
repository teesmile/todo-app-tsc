'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useAddTodo } from '../hooks/useTodos';

export const CreateTodo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [todo, setTodo] = useState('');
  const [completed, setCompleted] = useState(false);
  
  const addTodoMutation = useAddTodo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todo.trim()) return;
    
    addTodoMutation.mutate({
      todo: todo.trim(),
      completed,
      userId: 1, // Get from your auth context
    });

    // Reset and close on success
    setTodo('');
    setCompleted(false);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="size-4" />
        Create Todo
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-lg font-semibold mb-4">Create Todo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Todo</label>
                <input
                  type="text"
                  value={todo}
                  onChange={(e) => setTodo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  id="completed"
                />
                <label htmlFor="completed" className="text-sm">Mark as completed</label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
                  disabled={addTodoMutation.isPending}
                >
                  {addTodoMutation.isPending ? 'Creating...' : 'Create Todo'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
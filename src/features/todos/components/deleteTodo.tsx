'use client';

import { Trash } from 'lucide-react';
import { useState } from 'react';
import { useDeleteTodo } from '../hooks/useTodos';

type DeleteTodoProps = {
  id: string;
  onSuccess?: () => void;
};

export const DeleteTodo = ({ id, onSuccess }: DeleteTodoProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteTodoMutation = useDeleteTodo();

  const handleDelete = async () => {
    try {
      await deleteTodoMutation.mutateAsync(parseInt(id));
      onSuccess?.();
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
        title="Delete todo"
      >
        <Trash className="w-4 h-4" />
      </button>

      {/* Simple Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <div className="text-center">
              <Trash className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Delete Todo</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this todo? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirm(false)}
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
    </>
  );
};
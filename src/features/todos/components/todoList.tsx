'use client'

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Loader } from "lucide-react";
import { useTodos } from "../hooks/useTodos";

export type TodoListProps = {
  onTodoPrefetch?: (id: string) => void;
};

export const TodoList = ({ onTodoPrefetch }: TodoListProps) => {
  const searchParams = useSearchParams();
  const page = searchParams?.get('page') ? Number(searchParams.get('page')) : 1;
  const limit = searchParams?.get('limit') ? Number(searchParams.get('limit')) : 10;
  const skip = (page - 1) * limit;

  const todoQuery = useTodos({
    limit: limit,
    skip: skip,
  });

  if (todoQuery.isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (todoQuery.error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading todos</p>
      </div>
    );
  }

  const response = todoQuery.data;
  const todos = response?.todos || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (!todos.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No todos found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Todo List */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Todo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {todos.map((todo) => (
              <tr key={todo.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {todo.todo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    todo.completed 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {todo.completed ? 'Completed' : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {todo.userId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                    onClick={() => console.log('View todo:', todo.id)}
                  >
                    View
                  </button>
                  <button 
                    className="text-red-600 hover:text-red-900"
                    onClick={() => console.log('Delete todo:', todo.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simple Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} todos
        </div>
        <div className="flex space-x-2">
          <button 
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => console.log('Previous page')}
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm">
            Page {page} of {totalPages}
          </span>
          <button 
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => console.log('Next page')}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
'use client'

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Plus, Edit2, Trash2, Eye  } from "lucide-react";
import { useTodos } from "../hooks/useTodos";
import Link from "next/link";

// Import your modular components
import TodoItem from "./todoItem";
import { CreateTodo } from "./createTodo";
import { EditTodoForm } from "./editTodoForm";

export type TodoListProps = {
  onTodoPrefetch?: (id: string) => void;
};

export const TodoList = ({ onTodoPrefetch }: TodoListProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = searchParams?.get('page') ? Number(searchParams.get('page')) : 1;
  const limit = searchParams?.get('limit') ? Number(searchParams.get('limit')) : 10;
  const skip = (page - 1) * limit;

  const [editingTodo, setEditingTodo] = useState<number | null>(null);

  const todoQuery = useTodos({ limit, skip });


  // Dynamic date generation
  const getCurrentDate = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleDateString('en-US', { month: 'long' });
    return `${day} ${month}`;
  };

  const getTodayLabel = () => {
    const today = new Date();
    const currentDate = new Date();
    
    // Check if it's actually today
    if (today.toDateString() === currentDate.toDateString()) {
      return 'Today';
    }
    
    // You could also add logic for Yesterday, Tomorrow, etc.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (today.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (today.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return today.toLocaleDateString('en-US', { weekday: 'long' });
  };


  // Navigation functions
  const navigateToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('page', newPage.toString());
    router.push(`/?${params.toString()}`);
  };

  if (todoQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-16 w-16 animate-spin text-orange-500" />
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
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No todos found</p>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Create your first todo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Header */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
       <span>{getCurrentDate()}</span>
        <span className="text-orange-500 !important">{getTodayLabel()}</span>
      </div>

      {/* Todo Items */}
      <div className="space-y-3">
        {todos.map((todo) => (
          <div key={todo.id} className="group">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              {/* Priority Dot */}
              <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                todo.completed ? 'bg-gray-300' : 'bg-orange-400'
              }`} />
              
              {/* Todo Content */}
              <div className="flex-1 min-w-0">

                {editingTodo === todo.id ? (
                  <EditTodoForm
                    todo={todo}
                    onSave={() => setEditingTodo(null)}
                    onCancel={() => setEditingTodo(null)}
                  />
                ) : (
                  <TodoItem todo={todo} showActions={false} />
                )}
                
                {/* Task Details */}
                {editingTodo !== todo.id && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded-full ${
                    todo.completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {todo.completed ? 'Completed' : 'In Progress'}
                  </span>
                  <span>Priority: Moderate</span>
                  <span>Status: {todo.completed ? 'Completed' : 'Not Started'}</span>
                   {/* Action Buttons */}
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/todos/${todo.id}`}
                      className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    
                    <button
                      className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                      title="Edit todo"
                      onClick={() => {
                        // Toggle edit mode for this specific todo
                        setEditingTodo(editingTodo === todo.id ? null : todo.id);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
              </span>
                </div>
                )}
              </div>

              {/* Task Image/Icon */}
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex-shrink-0 flex items-center justify-center">
                <span className="text-white text-xs font-medium">{todo.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-sm text-gray-700">
            Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} todos
          </div>
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
              disabled={page <= 1}
              onClick={() => navigateToPage(page - 1)}
            >
              Prev
            </button>
            <span className="px-3 py-1 text-sm bg-orange-50 text-orange-600 rounded-md">
              {page} of {totalPages}
            </span>
            <button 
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
              disabled={page >= totalPages}
              onClick={() => navigateToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
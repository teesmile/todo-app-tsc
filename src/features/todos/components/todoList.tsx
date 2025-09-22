'use client'

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTodos } from "../hooks/useTodos";
import { Todo } from "@/types/api";

// Import your modular components
import TodoItem from "./todoItem";
import { DeleteTodo } from "./deleteTodo";

export type TodoListProps = {
  onTodoPrefetch?: (id: string) => void;
};

export const TodoList = ({ onTodoPrefetch }: TodoListProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = searchParams?.get('page') ? Number(searchParams.get('page')) : 1;
  const limit = searchParams?.get('limit') ? Number(searchParams.get('limit')) : 10;
  const skip = (page - 1) * limit;

  const todoQuery = useTodos({ limit, skip });

  // Navigation functions
  const navigateToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('page', newPage.toString());
    router.push(`/?${params.toString()}`);
  };

  if (todoQuery.isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <Loader2 className="h-28 w-28 animate-spin text-purple-900" />
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
      {/* Use your TodoItem component */}
      <div className="grid gap-4">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
            <TodoItem todo={todo} />
            
            {/* Use your DeleteTodo component */}
            <div className="flex items-center gap-2">
              <DeleteTodo id={todo.id.toString()} />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} todos
        </div>
        <div className="flex space-x-2">
          <button 
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            disabled={page <= 1}
            onClick={() => navigateToPage(page - 1)}
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm bg-gray-100 rounded">
            Page {page} of {totalPages}
          </span>
          <button 
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            disabled={page >= totalPages}
            onClick={() => navigateToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
'use client';
import Image from "next/image";

import { TodoList } from "@/features/todos/components/todoList";
import { CreateTodo } from "@/features/todos/components/createTodo";
import { useTodos } from "@/features/todos/hooks/useTodos";
import { Search, Bell, Calendar, Plus } from "lucide-react";
import { useMemo } from "react";

export default function Home() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Fetch todos for statistics
  const { data: todoData } = useTodos({ limit: 100, skip: 0 }); // Get more todos for stats

  // Calculate statistics
  const stats = useMemo(() => {
    if (!todoData?.todos) {
      return {
        completed: 0,
        inProgress: 0,
        completedPercentage: 0,
        inProgressPercentage: 0,
        totalTodos: 0,
        completedTodos: [],
        inProgressTodos: []
      };
    }

    const todos = todoData.todos;
    const totalTodos = todos.length;
    const completedTodos = todos.filter(todo => todo.completed);
    const inProgressTodos = todos.filter(todo => !todo.completed);
    
    const completedCount = completedTodos.length;
    const inProgressCount = inProgressTodos.length;
    
    const completedPercentage = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
    const inProgressPercentage = totalTodos > 0 ? Math.round((inProgressCount / totalTodos) * 100) : 0;

    return {
      completed: completedCount,
      inProgress: inProgressCount,
      completedPercentage,
      inProgressPercentage,
      totalTodos,
      completedTodos: completedTodos.slice(0, 3), // Show only recent 3
      inProgressTodos
    };
  }, [todoData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">
                <span className="text-orange-500">Dash</span>
                <span className="text-black">board</span>
              </h1>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search your task here..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Calendar className="w-5 h-5" />
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Tuesday</p>
                <p className="text-xs text-blue-500">{today.split(',')[1]?.trim()}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-orange-500 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-lg font-semibold">TS</span>
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold">Tonysmile</h3>
                  <p className="text-sm opacity-90">tonysmile.dev@gmail.com</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              <a href="#" className="flex items-center px-4 py-3 text-orange-500 bg-orange-50 rounded-lg font-medium">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                Dashboard
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                Vital Task
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                My Task
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span>
                Task Categories
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Settings
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                Help
              </a>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, Tonysmile 👋
              </h1>
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* Todo List */}
              <div className="col-span-8">
                <div className="bg-white rounded-2xl shadow-sm border">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">To-Do</h2>
                      <CreateTodo />
                    </div>
                  </div>
                  <div className="p-6">
                    <TodoList />
                  </div>
                </div>
              </div>

              {/* Right Sidebar - DYNAMIC */}
              <div className="col-span-4">
                {/* Task Status - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status</h3>
                  
                  {stats.totalTodos === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No tasks yet</p>
                      <p className="text-sm text-gray-400">Create your first task to see statistics</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Completed Circle */}
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 relative">
                          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                            {/* Background circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="rgb(187 247 208)" // green-200
                              strokeWidth="8"
                              fill="transparent"
                            />
                            {/* Progress circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="rgb(34 197 94)" // green-500
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray={`${stats.completedPercentage * 2.51} 251.2`}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-in-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-green-500">
                              {stats.completedPercentage}%
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          Completed 
                        </p>
                      </div>

                      {/* In Progress Circle */}
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 relative">
                          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                            {/* Background circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="rgb(254 215 170)" // orange-200
                              strokeWidth="8"
                              fill="transparent"
                            />
                            {/* Progress circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="rgb(249 115 22)" // orange-500
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray={`${stats.inProgressPercentage * 2.51} 251.2`}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-in-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-orange-500">
                              {stats.inProgressPercentage}%
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          In Progress 
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Completed Tasks - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Completed Tasks ({stats.completed})
                    </h3>
                    <button className="text-gray-400 hover:text-gray-600">
                      <span className="text-sm">⋯</span>
                    </button>
                  </div>

                  {/* Dynamic completed tasks */}
                  <div className="space-y-3">
                    {stats.completedTodos.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-sm">No completed tasks yet</p>
                      </div>
                    ) : (
                      stats.completedTodos.map((todo) => (
                        <div key={todo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {todo.todo}
                            </p>
                            <p className="text-xs text-gray-500">
                              Completed • User {todo.userId}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {stats.completed > 3 && (
                      <div className="text-center pt-2">
                        <button className="text-xs text-orange-600 hover:text-orange-700">
                          View all {stats.completed} completed tasks →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center mt-8 border-t pt-8">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Doc
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          @teesmile
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
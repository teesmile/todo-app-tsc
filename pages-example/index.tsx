import { GetStaticProps } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import { Todo, TodoFilter } from '../src/types/todo';

interface HomeProps {
  initialTodos?: Todo[];
}

export default function Home({ initialTodos = [] }: HomeProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [newTodoTitle, setNewTodoTitle] = useState('');

  const addTodo = (title: string) => {
    if (!title.trim()) return;
    
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      createdAt: new Date(),
    };
    
    setTodos(prev => [...prev, newTodo]);
    setNewTodoTitle('');
  };

  const toggleTodo = (id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTodo(newTodoTitle);
  };

  return (
    <>
      <Head>
        <title>Todo App - TypeScript (Pages Router)</title>
        <meta name="description" content="A simple todo application built with Next.js Pages Router and TypeScript" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            Todo App - Pages Router
          </h1>
          
          {/* Add Todo Form */}
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
          </form>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 justify-center">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg capitalize ${
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Todo List */}
          <div className="space-y-2">
            {filteredTodos.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {filter === 'all'
                  ? 'No todos yet. Add one above!'
                  : `No ${filter} todos.`}
              </p>
            ) : (
              filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span
                    className={`flex-1 ${
                      todo.completed
                        ? 'line-through text-gray-500'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Stats */}
          {todos.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              {todos.filter(t => !t.completed).length} of {todos.length} items remaining
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  // You could fetch initial todos from an API here
  return {
    props: {
      initialTodos: [],
    },
  };
};
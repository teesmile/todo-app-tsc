import { TodoFilter } from '@/types/todo';

interface TodoFiltersProps {
  currentFilter: TodoFilter;
  onFilterChange: (filter: TodoFilter) => void;
  todoCount: { total: number; active: number; completed: number };
}

export default function TodoFilters({ 
  currentFilter, 
  onFilterChange, 
  todoCount 
}: TodoFiltersProps) {
  const filters: { key: TodoFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: todoCount.total },
    { key: 'active', label: 'Active', count: todoCount.active },
    { key: 'completed', label: 'Completed', count: todoCount.completed },
  ];

  return (
    <div className="flex gap-2 mb-6 justify-center">
      {filters.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={`px-4 py-2 rounded-lg capitalize ${
            currentFilter === key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {label} {count !== undefined && count > 0 && `(${count})`}
        </button>
      ))}
    </div>
  );
}
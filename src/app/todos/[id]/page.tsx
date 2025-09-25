import { TodoDetail } from '@/features/todos/components/todoDetail';

interface TodoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TodoPage({ params }: TodoPageProps) {
  const { id } = await params;
  const todoId = parseInt(id);
  
  if (isNaN(todoId)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Todo ID</h1>
          <p className="text-gray-600 mt-2">Please provide a valid todo ID.</p>
        </div>
      </div>
    );
  }

  return <TodoDetail todoId={todoId} />;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: TodoPageProps) {
  const { id } = await params;
  
  return {
    title: `Todo ${id} | Todo App`,
    description: `View and edit todo ${id}`,
  };
}
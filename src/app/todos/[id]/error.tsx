"use client";

import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Something went wrong!</h1>
        <p className="text-gray-600 mt-2">{error.message}</p>
        <div className="mt-4 space-x-4">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
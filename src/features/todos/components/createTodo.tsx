'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { AddTodoForm } from './addTodoForm';

export const CreateTodo = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = () => {
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Todo
      </button>

      <Modal 
        isOpen={isOpen} 
        onClose={handleCancel}
        title={
          <>
            Create <span className="text-orange-500">New Todo</span>
          </>
        }
      >
        <AddTodoForm 
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </Modal>
    </>
  );
};
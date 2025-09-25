import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function TodoLayout({ children }: LayoutProps) {
  return (
    <div>
      {children}
    </div>
  );
}
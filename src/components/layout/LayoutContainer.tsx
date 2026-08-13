import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserRole } from '@/types/database.types';

export interface LayoutContainerProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: {
    name: string;
    email: string;
    role: UserRole;
  };
}

export function LayoutContainer({
  children,
  activeTab,
  onTabChange,
}: LayoutContainerProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-resto-charcoal-50 dark:bg-slate-950 font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header activeTab={activeTab} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

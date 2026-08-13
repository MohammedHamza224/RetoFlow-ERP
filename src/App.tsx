import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LayoutContainer } from '@/components/layout/LayoutContainer';
import { LoginPage } from '@/components/auth/LoginPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ViewContainer } from '@/components/views/ViewContainer';

function MainAppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  if (!user) {
    return <LoginPage />;
  }

  // Ensure active tab fallback if current tab is not allowed for user role
  const effectiveTab = activeTab;

  return (
    <LayoutContainer
      activeTab={effectiveTab}
      onTabChange={setActiveTab}
      currentUser={{
        name: user.name,
        email: user.email,
        role: user.role_name,
      }}
    >
      <ProtectedRoute
        moduleId={effectiveTab}
        onNavigateToAllowed={(fallbackTab) => setActiveTab(fallbackTab)}
      >
        <ViewContainer activeTab={effectiveTab} currentUser={{ name: user.name, email: user.email, role: user.role_name }} />
      </ProtectedRoute>
    </LayoutContainer>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

export default App;

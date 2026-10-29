import React from 'react';
import { UserManagement } from '@/components/users/UserManagement';

export function UserView() {
  return (
    <div className="animate-in fade-in duration-200">
      <UserManagement />
    </div>
  );
}

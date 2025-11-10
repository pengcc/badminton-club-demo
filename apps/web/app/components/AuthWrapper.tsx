'use client';

import { AuthProvider } from '@app/hooks/useAuth';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
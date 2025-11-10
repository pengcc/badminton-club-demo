'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserIcon, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@app/hooks/useAuth';
import { Button } from '@app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@app/components/ui/sheet';

interface UserMenuProps {
  lang: string;
}

export default function UserMenu({ lang }: UserMenuProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <Link href={`/${lang}/login`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9"
          aria-label="Login"
          title="Login"
        >
          <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </Link>
    );
  }

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-8 px-2 sm:h-9 sm:px-3"
        >
          <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline text-sm">{user?.fullName || `${user?.lastName}, ${user?.firstName}`}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle className="text-left">Account Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="px-2 py-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium">{user?.fullName || `${user?.lastName}, ${user?.firstName}`}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <p className="text-xs text-gray-500 capitalize">Role: {user?.role}</p>
          </div>

          <div className="space-y-2">
            <Link href={`/${lang}/dashboard`} onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href={`/${lang}/account`} onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <User className="h-4 w-4" />
                My Account
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
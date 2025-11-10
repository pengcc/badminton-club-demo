import Link from 'next/link';
import { UserIcon } from 'lucide-react';
import Logo from './Logo';
import MainNav from './MainNav';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import { Button } from '@app/components/ui/button';

interface HeaderProps {
  withMainNav?: boolean; // Whether to show the main navigation
  lang: string; // Current language for links
}
export default function Header({ withMainNav=false, lang}: HeaderProps) {
  return (
    <header className="sticky p-4 flex justify-between items-center top-0 z-50 bg-card shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Logo />
          {withMainNav && <MainNav />}
          {/* Right side: User Menu and Language switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            <UserMenu lang={lang} />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
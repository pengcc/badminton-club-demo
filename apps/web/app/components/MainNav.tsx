// Alternative using Sheet component
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@app/components/ui/sheet';

export default function MainNav() {
  const t = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
   /**
   * Handles closing the mobile menu when a link is clicked
   */
  const handleLinkClick = () => {
    setIsOpen(false);
  };
  const navItems = [
    { key: 'navigation.training', href: '#visit-us' },
    { key: 'navigation.contact', href: '#contact' },
    { key: 'navigation.about', href: '#about-us' },
    { key: 'navigation.documents', href: '#documents' },
  ];

  return (
    <nav className="w-full bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-center p-4">
        {/* Desktop menu */}
        <div className="hidden md:flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-foreground hover:text-primary transition-colors"
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
        {/* Mobile sheet menu */}
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px] bg-background">
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl font-bold text-primary">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={handleLinkClick}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent/50 rounded-lg transition-all duration-200 group"
                  >
                    <span>{t(item.key)}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      →
                    </span>
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
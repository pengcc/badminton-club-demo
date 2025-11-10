'use client';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  const t = useTranslations('common');
  const params = useParams();
  const lang = params.lang as string;

  return (
    <footer className="bg-muted text-muted-foreground py-8 px-4 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <Logo isInHeader={false} />
          <nav className="flex items-center gap-6 text-sm">
            <Link href={`/${lang}/imprint`} className="hover:text-foreground transition-colors">{t('footer.imprint')}</Link>
            <Link href={`/${lang}/privacy`} className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link>
          </nav>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>&copy; {t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
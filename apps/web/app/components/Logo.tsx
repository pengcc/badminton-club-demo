import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

interface LogoProps {
  isInHeader?: boolean; // Whether the logo is used in the header
}
export default function Logo({ isInHeader=true }: LogoProps) {
  const t = useTranslations('common');
  const imgMobileSrc = isInHeader ? "/images/logo-xs.png" : "/images/logo-transparent-xs.png";
  const imgDesktopSrc = isInHeader ? "/images/logo-s.png" : "/images/logo-transparent-s.png";

  return (
  <Link href="/" className="flex items-center text-xl font-bold text-primary">
    {/* Mobile logo */}
    <div className="relative w-8 h-8 sm:hidden">
      <Image
        src={imgMobileSrc}
        alt={t('club_name')}
        fill
        className="object-contain"
        priority
      />
    </div>

    {/* Desktop logo with text */}
    <div className="hidden sm:flex items-center">
      <div className="relative w-10 h-10 mr-2">
        <Image
          src={imgDesktopSrc}
          alt={t('club_name')}
          fill
          className="object-contain"
          priority
        />
      </div>
      <span>{t('club_name')}</span>
    </div>
  </Link>
  );
}
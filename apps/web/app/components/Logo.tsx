import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';

interface LogoProps {
  isInHeader?: boolean; // Whether the logo is used in the header
}
export default function Logo({ isInHeader = true }: LogoProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const imageSrc = '/images/badminton-logo-256.png';

  return (
    <Link
      href={`/${locale}`}
      className="flex items-center text-xl font-bold text-primary"
    >
      <div className="relative h-8 w-8 sm:mr-2 sm:h-10 sm:w-10">
        <Image
          src={imageSrc}
          alt={t('club_name')}
          fill
          sizes="(max-width: 639px) 32px, 40px"
          className="object-contain"
          priority={isInHeader}
        />
      </div>
      <span className="hidden sm:inline sm:max-w-40 sm:text-base lg:max-w-48">
        {t('club_name')}
      </span>
    </Link>
  );
}

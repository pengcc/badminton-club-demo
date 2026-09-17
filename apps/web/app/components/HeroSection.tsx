import {
  getClubInformation,
  getHomepageContent,
} from '@app/lib/data/getHomepageContent';
import { getTranslations } from 'next-intl/server';
import type { Language } from '@club/shared-types/core/enums';
import Link from 'next/link';

interface HeroSectionProps {
  locale: Language;
}

export default async function HeroSection({ locale }: HeroSectionProps) {
  const [content, club, t] = await Promise.all([
    getHomepageContent(locale),
    getClubInformation(locale),
    getTranslations({ locale, namespace: 'common' }),
  ]);

  return (
    <section className="relative bg-gradient-to-r from-indigo-900 to-purple-700 text-white py-12">
      {/* Section overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMCAxMGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMCAxMGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptLTE4LTMwYzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0wIDEwYzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0wIDEwYzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0tMTgtMzBjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6bTAgMTBjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6bTAgMTBjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9nPjwvc3ZnPg==')] opacity-20"></div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <h1 className="break-words text-4xl md:text-5xl font-bold">
          {content.status === 'ready'
            ? content.data.mainMessage
            : t('homepage.mainMessageUnavailable')}
        </h1>
        {club.status === 'ready' && club.data.localizedName && (
          <p className="mx-auto mt-4 max-w-3xl text-lg text-white/90 md:text-xl">
            {club.data.localizedName}
            {club.data.shortName && ` (${club.data.shortName})`}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}#visit-us`}
            className="rounded-md bg-white px-5 py-2.5 font-medium text-indigo-950 transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
          >
            {t('navigation.training')}
          </Link>
          <Link
            href={`/${locale}#participation`}
            className="rounded-md border border-white/70 px-5 py-2.5 font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
          >
            {t('navigation.join')}
          </Link>
        </div>
      </div>
    </section>
  );
}

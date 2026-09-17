import { useTranslations } from 'next-intl';

export default function ShowcaseNotice() {
  const t = useTranslations('common');
  return (
    <aside
      aria-label={t('club_name')}
      className="border-b bg-muted/30 px-4 py-3 text-sm text-foreground"
    >
      <p className="container mx-auto">
        <strong>Badminton Club Demo</strong>
        {' — '}
        {t('showcase.disclosure')}
      </p>
    </aside>
  );
}

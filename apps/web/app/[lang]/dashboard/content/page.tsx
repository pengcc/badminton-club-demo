import { setRequestLocale } from 'next-intl/server';
import ContentOverview from '@app/components/Dashboard/content/ContentOverview';

export default async function ContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return <ContentOverview />;
}

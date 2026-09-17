import { setRequestLocale } from 'next-intl/server';
import ClubInformationContentEditor from '@app/components/Dashboard/content/ClubInformationContentEditor';

export default async function ClubInformationContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return <ClubInformationContentEditor />;
}

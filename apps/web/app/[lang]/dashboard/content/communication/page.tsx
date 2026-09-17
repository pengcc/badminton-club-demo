import { setRequestLocale } from 'next-intl/server';
import CommunicationContentEditor from '@app/components/Dashboard/content/CommunicationContentEditor';

export default async function CommunicationContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return <CommunicationContentEditor />;
}

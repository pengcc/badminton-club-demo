import { setRequestLocale } from 'next-intl/server';
import MembershipParticipationContentEditor from '@app/components/Dashboard/content/MembershipParticipationContentEditor';

export default async function MembershipParticipationContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return <MembershipParticipationContentEditor />;
}

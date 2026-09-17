import { redirect } from 'next/navigation';

export default async function LegacyTrialTrainingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/taster-session`);
}

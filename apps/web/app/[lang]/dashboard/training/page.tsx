import { redirect } from 'next/navigation';

export default async function LegacyTrainingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/dashboard/taster-sessions`);
}

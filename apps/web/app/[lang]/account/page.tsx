import AccountClient from '@app/components/Account/AccountClient';
import { setRequestLocale } from 'next-intl/server';

// Prevent static generation for this page since it requires authentication
export const dynamic = 'force-dynamic';
// Ensures /account page is always fresh and server-rendered, never cached or reused.
export const revalidate = 0;

interface AccountPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function Account({ params }: AccountPageProps) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return <AccountClient />;
}
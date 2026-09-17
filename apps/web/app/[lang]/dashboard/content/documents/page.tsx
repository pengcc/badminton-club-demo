import { setRequestLocale } from 'next-intl/server';
import PublicDocumentManager from '@app/components/Dashboard/PublicDocumentManager';
import { ContentDomainHeader } from '@app/components/Dashboard/content/ContentDomainHeader';

export default async function DocumentsContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return (
    <div>
      <ContentDomainHeader domain="documents" />
      <PublicDocumentManager />
    </div>
  );
}

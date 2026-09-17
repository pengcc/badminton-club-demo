import { setRequestLocale } from 'next-intl/server';
import HomepageCopyEditor from '@app/components/Dashboard/HomepageCopyEditor';
import { ContentDomainHeader } from '@app/components/Dashboard/content/ContentDomainHeader';

export default async function HomepageContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return (
    <div>
      <ContentDomainHeader domain="homepage" />
      <HomepageCopyEditor />
    </div>
  );
}

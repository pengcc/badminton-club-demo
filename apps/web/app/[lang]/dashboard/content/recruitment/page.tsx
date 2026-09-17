import { setRequestLocale } from 'next-intl/server';
import RecruitmentContentEditor from '@app/components/Dashboard/RecruitmentContentEditor';
import { ContentDomainHeader } from '@app/components/Dashboard/content/ContentDomainHeader';

export default async function RecruitmentContentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);

  return (
    <div>
      <ContentDomainHeader domain="recruitment" />
      <RecruitmentContentEditor />
    </div>
  );
}

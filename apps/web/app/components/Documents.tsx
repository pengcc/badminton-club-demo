import { getTranslations } from 'next-intl/server';
import { getPublicDocuments } from '@app/lib/data/getPublicDocuments';
import type { Language } from '@club/shared-types/core/enums';

export default async function Documents({ locale }: { locale: Language }) {
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getPublicDocuments(locale),
  ]);

  return (
    <section
      id="documents"
      className="container mx-auto scroll-mt-28 px-4 py-10"
    >
      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-foreground">
          {t('documents')}
        </h2>
        {result.status === 'unavailable' ? (
          <p className="text-sm text-muted-foreground">
            {t('documents_unavailable')}
          </p>
        ) : result.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('documents_none')}</p>
        ) : (
          <ul className="space-y-3">
            {result.documents.map((document) => (
              <li key={document.id}>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {document.displayName}
                </a>
                <p className="text-sm text-muted-foreground">
                  {t('document_version_date', { date: document.documentDate })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

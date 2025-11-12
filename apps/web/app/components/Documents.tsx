'use client';
import { useTranslations } from 'next-intl';

export default function Documents() {
  const t = useTranslations('common');

  return (
    <section id="documents" className="container mx-auto px-4 py-10">
      <div className="max-w-4xl mx-auto bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground border-b pb-2 mb-4">{t('documents')}</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a href="/documents/Beitragsordnung-Muster.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t('fee_regulation')}
            </a>
          </li>
          <li>
            <a href="/documents/Satzung-Muster.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t('statutes')}
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}



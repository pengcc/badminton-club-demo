import Image from 'next/image';
import { ExternalLink, Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Language } from '@club/shared-types/core/enums';
import { getHomepageContent } from '@app/lib/data/getHomepageContent';
import { getPublicContactEntries } from '@app/lib/data/getPublicContactEntries';
import { shouldBypassImageOptimization } from '@app/lib/imageOptimization';

export default async function ContactSection({ locale }: { locale: Language }) {
  const [content, contacts, t] = await Promise.all([
    getHomepageContent(locale),
    getPublicContactEntries(locale),
    getTranslations({ locale, namespace: 'common' }),
  ]);

  return (
    <section id="contact" className="scroll-mt-28 bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            {t('contact.title')}
          </h2>
          {content.status === 'ready' ? (
            content.data.contactIntroduction ? (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {content.data.contactIntroduction}
              </p>
            ) : null
          ) : (
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t('contact.introductionUnavailable')}
            </p>
          )}
        </div>

        {contacts.status === 'unavailable' ? (
          <p className="text-center text-muted-foreground">
            {t('contact.unavailable')}
          </p>
        ) : contacts.entries.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {t('contact.none')}
          </p>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            {contacts.entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-full bg-primary/10 p-3">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      {entry.title}
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                    <a
                      href={`mailto:${entry.email}`}
                      className="font-medium text-primary [overflow-wrap:anywhere] transition-colors hover:text-primary/80"
                    >
                      {entry.email}
                    </a>
                    {entry.qrCode && (
                      <div className="mt-4 flex items-center gap-3">
                        <Image
                          src={entry.qrCode}
                          alt={entry.qrExplanation || entry.title}
                          width={112}
                          height={112}
                          className="rounded border"
                          unoptimized={shouldBypassImageOptimization(
                            entry.qrCode
                          )}
                        />
                        {entry.qrExplanation && (
                          <p className="text-sm text-muted-foreground">
                            {entry.qrExplanation}
                          </p>
                        )}
                      </div>
                    )}
                    {entry.externalLink && entry.externalLinkLabel && (
                      <a
                        href={entry.externalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {entry.externalLinkLabel}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

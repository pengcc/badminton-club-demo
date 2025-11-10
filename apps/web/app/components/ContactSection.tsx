'use client';

import { useTranslations } from 'next-intl';
import { Mail, Users } from 'lucide-react';
import Link from 'next/link';

export default function ContactSection() {
  const t = useTranslations('common');

  return (
    <section id="contact" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('contact.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('contact.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: General Inquiries */}
          <div className="bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-full flex-shrink-0">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2 text-lg">{t('contact.general.title')}</h3>
                <p className="text-muted-foreground mb-3 text-sm">{t('contact.general.description')}</p>
                <a
                  href={`mailto:info@dcbev.de`}
                  className="text-primary hover:text-primary/80 font-medium transition-colors block mb-4"
                >
                  info@dcbev.de
                </a>
              </div>
            </div>
          </div>

          {/* Card 2: Membership & Trial Training */}
          <div className="bg-card rounded-lg p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/10 p-3 rounded-full flex-shrink-0">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2 text-lg">{t('contact.membership.title')}</h3>
                <p className="text-muted-foreground mb-3 text-sm">{t('contact.membership.description')}</p>
                <a
                  href={`mailto:mitgliedschaft@dcbev.de`}
                  className="text-blue-500 hover:text-blue-600 font-medium transition-colors block mb-4"
                >
                  mitgliedschaft@dcbev.de
                </a>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 mt-4">
                  <Link
                    href="/membership"
                    className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600 transition-colors text-center"
                  >
                    {t('contact.buttons.membership')}
                  </Link>
                  <Link
                    href="/trial-training"
                    className="border border-blue-500 text-blue-500 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors text-center"
                  >
                    {t('contact.buttons.trial_training')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
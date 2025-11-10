import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import Header from '@app/components/Header';

export default async function ImprintPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  const t = await getTranslations('common');

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Header lang={lang} />
      <div className="max-w-4xl mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{t('pages.imprint')}</h1>
          <p className="mt-2 text-muted-foreground">Angaben und Kontaktinformationen des Vereins</p>
        </div>

        <div className="space-y-6">
          <section className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground border-b pb-2 mb-4">Angaben gemäß § 5 TMG</h2>
            <p className="leading-relaxed">
              Deutsch-Chinesischer Badminton Verein e. V.<br />
              Berliner Str. 161<br />
              10715 Berlin
            </p>
            <p className="mt-4 leading-relaxed">
              Vereinsregister: VR 29453<br />
              Registergericht: Charlottenburg
            </p>
          </section>

          <section className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground border-b pb-2 mb-4">Vertreten durch</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <p><span className="font-medium">Vorsitzende:</span> Zhang, Xi</p>
              <p><span className="font-medium">Stellvertreter:</span> Cui, Pengcheng</p>
              <p><span className="font-medium">Schatzmeisterin:</span> Yang, Yao</p>
              <p><span className="font-medium">Sportwart:</span> Yu, Jingyang</p>
              <p><span className="font-medium">Schriftführerin:</span> Zheng, Huishu</p>
            </div>
          </section>

          <section className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground border-b pb-2 mb-4">Kontakt</h2>
            <p className="leading-relaxed">E-Mail: <a href="mailto:info@dcbev.de" className="text-primary hover:underline">info@dcbev.de</a></p>
          </section>


        </div>
      </div>
    </div>
  );
}



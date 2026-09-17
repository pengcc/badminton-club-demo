import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Trophy,
  Users,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { RecruitmentPublicContentPublicResponse } from '@club/shared-types/api/recruitmentPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';
import type { PublicContentResult } from '@app/lib/data/getParticipationPublicContent';
import type { PublicContactEntriesResult } from '@app/lib/data/getPublicContactEntries';
import type { PublicLocation } from '@app/lib/data/getHomepageContent';
import type { PublicTeam } from '@app/lib/data/getTeamsPageData';
import type { PublicProjectionResult } from '@app/lib/data/publicProjection';
import { getLocationWeekdayLabel } from '@app/lib/locationTimeSlots';
import { shouldBypassImageOptimization } from '@app/lib/imageOptimization';
import { formatTeamClass } from '@app/lib/teamClass';

interface RecruitmentPageContentProps {
  locale: Language;
  recruitment: PublicContentResult<RecruitmentPublicContentPublicResponse>;
  teams: PublicProjectionResult<PublicTeam[]>;
  locations: PublicProjectionResult<PublicLocation[]>;
  contacts: PublicContactEntriesResult;
}

const processSteps = [
  { key: 'responsible', Icon: MessageCircle },
  { key: 'tryout', Icon: CalendarDays },
  { key: 'evaluation', Icon: Users },
] as const;

export default async function RecruitmentPageContent({
  locale,
  recruitment,
  teams,
  locations,
  contacts,
}: RecruitmentPageContentProps) {
  const t = await getTranslations({ locale, namespace: 'common.recruitment' });
  const selectedContact =
    recruitment.status === 'ready' && contacts.status === 'ready'
      ? contacts.entries.find(
          (entry) => entry.id === recruitment.content.contactEntryId
        )
      : undefined;
  const isOpen = recruitment.status === 'ready' && recruitment.content.isOpen;
  const requirementLines =
    recruitment.status === 'ready'
      ? recruitment.content.requirements
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  return (
    <>
      <section className="relative isolate min-h-[21rem] overflow-hidden bg-slate-950 text-white sm:min-h-[34rem]">
        <Image
          src="/images/federball_im_scheinwerferlicht.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[72%_center] sm:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/25" />
        <div className="container mx-auto flex min-h-[21rem] items-center px-4 py-10 sm:min-h-[34rem] sm:py-16">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">
              {t('eyebrow')}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            {recruitment.status === 'ready' ? (
              <p className="max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">
                {recruitment.content.introduction}
              </p>
            ) : (
              <p className="max-w-2xl rounded-md border border-white/30 bg-slate-950/70 p-4 text-white/90">
                {t('unavailable')}
              </p>
            )}
          </div>
        </div>
      </section>

      {recruitment.status === 'ready' && !recruitment.content.isOpen && (
        <section className="border-b bg-amber-50 py-6 text-amber-950">
          <div className="container mx-auto px-4">
            <div role="status" className="mx-auto max-w-4xl">
              <h2 className="font-semibold">{t('status.paused')}</h2>
              <p className="mt-1 text-sm text-amber-900">
                {t('status.pausedDescription')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="container mx-auto grid gap-6 px-4 lg:grid-cols-3">
          <article className="rounded-2xl border bg-background p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3 border-b pb-4 text-indigo-700">
              <Users className="h-7 w-7" aria-hidden="true" />
              <h2 className="text-xl font-semibold">
                {t('requirements.title')}
              </h2>
            </div>
            {recruitment.status === 'unavailable' ? (
              <p className="mt-5 text-muted-foreground">
                {t('sectionUnavailable')}
              </p>
            ) : requirementLines.length > 1 ? (
              <ul className="mt-5 space-y-3 text-muted-foreground">
                {requirementLines.map((line, index) => (
                  <li key={`${index}-${line}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 leading-relaxed text-muted-foreground">
                {requirementLines[0]}
              </p>
            )}
          </article>

          <article className="rounded-2xl border bg-background p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3 border-b pb-4 text-orange-600">
              <Trophy className="h-7 w-7" aria-hidden="true" />
              <h2 className="text-xl font-semibold">{t('teams.title')}</h2>
            </div>
            <div className="mt-5 space-y-4">
              {teams.status === 'unavailable' ? (
                <p className="text-muted-foreground">
                  {t('teams.unavailable')}
                </p>
              ) : teams.data.length === 0 ? (
                <p className="text-muted-foreground">{t('teams.empty')}</p>
              ) : (
                <ul className="space-y-4">
                  {teams.data.map((team) => (
                    <li key={team.shortName}>
                      <p className="font-medium">{team.shortName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTeamClass(team.matchLevel)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/${locale}/teams`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('teams.detailLink')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border bg-background p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3 border-b pb-4 text-violet-700">
              <CalendarDays className="h-7 w-7" aria-hidden="true" />
              <h2 className="text-xl font-semibold">{t('training.title')}</h2>
            </div>
            <div className="mt-5 space-y-4">
              {locations.status === 'unavailable' ? (
                <p className="text-muted-foreground">
                  {t('training.unavailable')}
                </p>
              ) : locations.data.length === 0 ? (
                <p className="text-muted-foreground">{t('training.empty')}</p>
              ) : (
                <ul className="space-y-3">
                  {locations.data.map((location) => {
                    const weekdays = [
                      ...new Set(
                        location.timeSlots
                          .filter((slot) => slot.active)
                          .map((slot) =>
                            getLocationWeekdayLabel(slot.weekday, locale)
                          )
                      ),
                    ];

                    return (
                      <li key={location.id} className="flex items-start gap-2">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium">{location.name}</p>
                          {weekdays.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {weekdays.join(' · ')}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('training.contextNotice')}
              </p>
              <Link
                href={`/${locale}#visit-us`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('training.detailLink')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {isOpen && (
        <section className="bg-background py-12 sm:py-16">
          <div className="container mx-auto px-4">
            {selectedContact ? (
              <div className="grid overflow-hidden rounded-2xl border bg-slate-50 shadow-sm md:grid-cols-2">
                <article
                  aria-label={t('contact.wechatLabel')}
                  className="flex items-center gap-5 border-b p-6 sm:p-8 md:border-b-0 md:border-r"
                >
                  {selectedContact.qrCode ? (
                    <Image
                      src={selectedContact.qrCode}
                      alt={
                        selectedContact.qrExplanation ||
                        t('contact.wechatLabel')
                      }
                      width={128}
                      height={128}
                      className="h-28 w-28 shrink-0 rounded-md border bg-background object-contain"
                      unoptimized={shouldBypassImageOptimization(
                        selectedContact.qrCode
                      )}
                    />
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-green-50">
                      <Image
                        src="/images/wechat.png"
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-primary">
                      {t('contact.wechatLabel')}
                    </p>
                    {selectedContact.qrExplanation ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedContact.qrExplanation}
                      </p>
                    ) : !selectedContact.qrCode ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('contact.wechatUnavailable')}
                      </p>
                    ) : null}
                    {selectedContact.externalLink &&
                      selectedContact.externalLinkLabel && (
                        <a
                          href={selectedContact.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          {selectedContact.externalLinkLabel}
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </a>
                      )}
                  </div>
                </article>
                <article
                  aria-label={t('contact.emailLabel')}
                  className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                    <Mail className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`mailto:${selectedContact.email}`}
                      className="break-all font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {t('contact.emailLabel')}: {selectedContact.email}
                    </a>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {recruitment.content.tryoutGuidance}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="sm:ml-auto">
                    <a href={`mailto:${selectedContact.email}`}>
                      {t('contact.emailAction')}
                    </a>
                  </Button>
                </article>
              </div>
            ) : (
              <p className="mx-auto max-w-3xl rounded-2xl border bg-slate-50 p-6 text-muted-foreground shadow-sm sm:p-8">
                {t('contact.unavailable')}
              </p>
            )}
          </div>
        </section>
      )}

      {isOpen && selectedContact && (
        <section className="bg-slate-50 py-14 sm:py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">
              {t('process.title')}
            </h2>
            <ol className="mt-10 grid gap-6 border-l border-border pl-9 lg:grid-cols-3 lg:border-l-0 lg:pl-0">
              {processSteps.map(({ key, Icon }, index) => (
                <li key={key} className="relative lg:flex lg:gap-5">
                  <span className="absolute -left-[3.25rem] top-0 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-700 lg:static lg:h-16 lg:w-16 lg:shrink-0">
                    <Icon
                      className="h-6 w-6 lg:h-7 lg:w-7"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <h3 className="font-semibold">
                      {t(`process.${key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`process.${key}.description`)}
                    </p>
                  </div>
                  {index < processSteps.length - 1 && (
                    <ArrowRight
                      className="absolute -right-4 top-5 hidden h-5 w-5 text-violet-500 lg:block"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="relative isolate overflow-hidden bg-orange-50 py-20 text-slate-950 sm:py-24">
        <Image
          src="/images/pastellfarbene_badminton_illustration_mit_shuttlec.png"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover object-[82%_center] sm:object-center"
        />
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">{t('closing.title')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-800">
            {t('closing.description')}
          </p>
        </div>
      </section>
    </>
  );
}

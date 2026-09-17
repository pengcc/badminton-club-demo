import {
  getLocations,
  getHomepageContent,
} from '@app/lib/data/getHomepageContent';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { MapPin, Clock, Calendar, ImageOff } from 'lucide-react';
import type { LocationTimeSlot } from '@club/shared-types/api/location';
import type { Language } from '@club/shared-types/core/enums';
import {
  getLocationTimeSlotNote,
  getLocationWeekdayLabel,
} from '@app/lib/locationTimeSlots';
import { shouldBypassImageOptimization } from '@app/lib/imageOptimization';

interface ClubLocation {
  id: number | string;
  name: string;
  address: string;
  timeSlots: LocationTimeSlot[];
  image?: string;
}

interface VisitUsProps {
  locale: Language;
}

export default async function VisitUs({ locale }: VisitUsProps) {
  const [locationsResult, content, t] = await Promise.all([
    getLocations(locale),
    getHomepageContent(locale),
    getTranslations('common'),
  ]);

  const title = t('visitUs.title');
  const description =
    content.status === 'ready' ? content.data.visitUsIntroduction : null;
  const openingHoursLabel = t('visitUs.openingHours');

  // Transform API locations to component format
  const locations: ClubLocation[] =
    locationsResult.status === 'ready'
      ? locationsResult.data.map((loc) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          timeSlots: loc.timeSlots.filter((timeSlot) => timeSlot.active),
          image: loc.imageUrl.trim() || undefined,
        }))
      : [];

  return (
    <section id="visit-us" className="scroll-mt-28 bg-card py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {title}
          </h2>
          {description ? (
            <p className="text-lg text-muted-foreground">{description}</p>
          ) : content.status === 'unavailable' ? (
            <p className="text-lg text-muted-foreground">
              {t('visitUs.introductionUnavailable')}
            </p>
          ) : null}
        </div>

        {locationsResult.status === 'unavailable' ? (
          <p className="text-center text-muted-foreground">
            {t('visitUs.unavailable')}
          </p>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {t('visitUs.none')}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {locations.map((location) => (
              <div
                key={location.id}
                className="bg-background rounded-lg overflow-hidden shadow-md border border-border flex flex-col md:flex-row h-full"
              >
                {/* Content area - same for both mobile and desktop */}
                <div className="p-6 flex-1">
                  <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    {location.name}
                  </h3>

                  <div className="space-y-4">
                    {/* Address */}
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <p className="text-muted-foreground">
                        {location.address}
                      </p>
                    </div>

                    {/* Opening Hours */}
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground mb-3">
                          {openingHoursLabel}
                        </h4>

                        {/* Opening hours list - always vertical */}
                        <div className="space-y-2">
                          {location.timeSlots.map((timeSlot) => {
                            const note = getLocationTimeSlotNote(
                              timeSlot,
                              locale
                            );

                            return (
                              <div
                                key={timeSlot.id}
                                className="bg-muted/30 p-2 rounded-md"
                              >
                                <div className="flex justify-between items-center gap-3">
                                  <span className="text-sm font-medium text-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {getLocationWeekdayLabel(
                                      timeSlot.weekday,
                                      locale
                                    )}
                                  </span>
                                  <span className="text-sm text-muted-foreground bg-background px-2 py-1 rounded whitespace-nowrap">
                                    {timeSlot.startTime}–{timeSlot.endTime}
                                  </span>
                                </div>
                                {note && (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {note}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Mobile: Image at bottom */}
                <div className="md:hidden aspect-video rounded-lg bg-muted overflow-hidden relative">
                  {location.image ? (
                    <Image
                      src={location.image}
                      alt={location.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                      unoptimized={shouldBypassImageOptimization(
                        location.image
                      )}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full items-center justify-center text-muted-foreground/60"
                    >
                      <ImageOff className="h-10 w-10" />
                    </div>
                  )}
                </div>

                {/* Desktop: Image on the right side with equal height */}
                <div className="hidden md:block md:w-2/5 bg-muted overflow-hidden relative">
                  {location.image ? (
                    <Image
                      src={location.image}
                      alt={location.name}
                      fill
                      sizes="40vw"
                      className="object-cover"
                      unoptimized={shouldBypassImageOptimization(
                        location.image
                      )}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full min-h-48 items-center justify-center text-muted-foreground/60"
                    >
                      <ImageOff className="h-10 w-10" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

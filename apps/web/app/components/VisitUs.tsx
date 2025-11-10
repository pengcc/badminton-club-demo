'use client';
import { useTranslations } from 'next-intl';
import { MapPin, Clock, Calendar } from 'lucide-react';

interface ClubLocation {
  id: number;
  name: string;
  address: string;
  openingHours: { day: string; time: string }[];
  image: string;
}

export default function VisitUs() {
  const t = useTranslations('common');
  const locations: ClubLocation[] = [
    {
      id: 1,
      name: t('visitUs.locations.main.name'),
      address: t('visitUs.locations.main.address'),
      openingHours: [
        { day: t('friday'), time: "19:00 – 21:30" },
        { day: t('sunday'), time: "15:00 – 20:00" }
      ],
      image: '/images/location-tu.jpeg'
    },
    {
      id: 2,
      name: t('visitUs.locations.secondary.name'),
      address: t('visitUs.locations.secondary.address'),
      openingHours: [
        { day: t('tuesday'), time: "19:00 – 22:00" },
        { day: t('friday'), time: "19:00 – 22:00" },
        { day: t('saturday'), time: "14:00 – 20:00" },
        { day: t('sunday'), time: "14:00 – 20:00" }
      ],
      image: '/images/location-pu.jpeg'
    }
  ];

  return (
    <section id="visit-us" className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('visitUs.title')}</h2>
          <p className="text-lg text-muted-foreground">
            {t('visitUs.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {locations.map((location) => (
            <div key={location.id} className="bg-background rounded-lg overflow-hidden shadow-md border border-border flex flex-col md:flex-row h-full">
              {/* Content area - same for both mobile and desktop */}
              <div className="p-6 flex-1">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  {location.name}
                </h3>

                <div className="space-y-4">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <p className="text-muted-foreground">{location.address}</p>
                  </div>

                  {/* Opening Hours */}
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground mb-3">{t('visitUs.openingHours')}</h4>

                      {/* Opening hours list - always vertical */}
                      <div className="space-y-2">
                        {location.openingHours.map((openingHour, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center bg-muted/30 p-2 rounded-md"
                          >
                            <span className="text-sm font-medium text-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {openingHour.day}
                            </span>
                            <span className="text-sm text-muted-foreground bg-background px-2 py-1 rounded">
                              {openingHour.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Mobile: Image at bottom */}
              <div className="md:hidden aspect-video rounded-lg bg-muted overflow-hidden">
                <img
                  src={location.image}
                  alt={location.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Desktop: Image on the right side with equal height */}
              <div className="hidden md:block md:w-2/5 bg-muted overflow-hidden">
                <img
                  src={location.image}
                  alt={location.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
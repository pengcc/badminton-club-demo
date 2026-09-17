import { getTranslations } from 'next-intl/server';
import { getAnnouncements } from '@app/lib/data/getHomepageContent';
import type { Language } from '@club/shared-types/core/enums';
import { ExternalLink } from 'lucide-react';

interface Notification {
  id: string | number;
  title: string;
  content: string;
  date: string;
  type: string;
  externalLink?: string;
}

interface LatestUpdatesProps {
  locale: Language;
}

export default async function LatestUpdates({ locale }: LatestUpdatesProps) {
  const [announcements, t] = await Promise.all([
    getAnnouncements(locale),
    getTranslations('common'),
  ]);

  const sectionTitle = t('updates.title');

  if (announcements.status === 'unavailable') {
    return (
      <section id="updates" className="bg-background py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            {sectionTitle}
          </h2>
          <p className="text-muted-foreground">{t('updates.unavailable')}</p>
        </div>
      </section>
    );
  }

  if (announcements.data.length === 0) {
    return null;
  }

  // Transform API announcements to component format
  const notifications: Notification[] = announcements.data.map(
    (announcement: any) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      date: announcement.displayDate,
      type: announcement.type,
      externalLink: announcement.externalLink,
    })
  );

  const displayedNotifications = notifications;

  const badgeVariants = {
    important: 'bg-destructive text-destructive-foreground',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-muted text-muted-foreground',
  };

  const getBadgeVariantStyle = (type: string) => {
    return (
      badgeVariants[type as keyof typeof badgeVariants] || badgeVariants.info
    );
  };

  const getTypeLabel = (type: string) => {
    if (type === 'important' || type === 'warning' || type === 'info') {
      return t(`updates.type.${type}`);
    }
    return type;
  };

  // Determine layout based on number of notifications
  const getCardsLayout = () => {
    switch (displayedNotifications.length) {
      case 1:
        return 'flex justify-center'; // Single notification centered
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-6'; // Two notifications: one column on mobile, two on desktop
      case 3:
        return 'grid grid-cols-1 md:grid-cols-3 gap-6'; // Three notifications: one column on mobile, three on desktop
      case 4:
        return 'grid grid-cols-1 md:grid-cols-2 gap-6'; // Four notifications: one column on mobile, two on desktop
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'; // Default: responsive grid
    }
  };

  // Determine card width for single notification
  const getCardWidth = () => {
    return displayedNotifications.length === 1 ? 'max-w-4xl' : '';
  };

  return (
    <section id="updates" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {sectionTitle}
          </h2>
        </div>

        <div className={getCardsLayout()}>
          {displayedNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-card rounded-lg shadow-md border border-border hover:shadow-lg transition-shadow p-6 ${getCardWidth()}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {notification.title}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${getBadgeVariantStyle(notification.type)}`}
                >
                  {getTypeLabel(notification.type)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {notification.date}
              </p>
              <p className="text-muted-foreground">{notification.content}</p>
              {notification.externalLink && (
                <a
                  href={notification.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t('updates.externalLink')}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

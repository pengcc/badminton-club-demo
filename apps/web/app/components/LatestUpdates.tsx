'use client';
import { useTranslations } from 'next-intl';

interface Notification {
  id: number;
  title: string;
  content: string;
  date: string;
  type: string;
  shouldDisplay: boolean;
}

export default function LatestUpdates() {
  const t = useTranslations('common');

  const notifications: Notification[] = [
    {
      id: 1,
      title: t('updates.1.title'),
      content: t('updates.1.content'),
      date: t('updates.1.date'),
      type: 'info',
      shouldDisplay: true,
    },
    {
      id: 2,
      title: t('updates.2.title'),
      content: t('updates.2.content'),
      date: t('updates.2.date'),
      type: 'important',
      shouldDisplay: true,
    }
  ];

  const displayedNotifications = notifications.filter(n => n.shouldDisplay);

  const badgeVariants = {
    important: 'bg-destructive text-destructive-foreground',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-muted text-muted-foreground'
  };

  const getBadgeVariantStyle = (type: string) => {
    return badgeVariants[type as keyof typeof badgeVariants] || badgeVariants.info;
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
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('updates.title')}</h2>
        </div>

        <div className={getCardsLayout()}>
          {displayedNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-card rounded-lg shadow-md border border-border hover:shadow-lg transition-shadow p-6 ${getCardWidth()}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">{notification.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${getBadgeVariantStyle(notification.type)}`}>
                  {t(`updates.type.${notification.type}`)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{notification.date}</p>
              <p className="text-muted-foreground">{notification.content}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {notifications.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-muted/30 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-foreground mb-2">{t('updates.empty.title')}</h3>
              <p className="text-muted-foreground">{t('updates.empty.description')}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
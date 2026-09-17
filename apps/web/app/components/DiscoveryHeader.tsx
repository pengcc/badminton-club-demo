import Header from './Header';
import { getActivitiesAvailability } from '@app/lib/data/getActivitiesAvailability';

interface DiscoveryHeaderProps {
  lang: string;
}

export default async function DiscoveryHeader({ lang }: DiscoveryHeaderProps) {
  const availability = await getActivitiesAvailability();

  return (
    <Header
      intent="discovery"
      lang={lang}
      activitiesEnabled={
        availability.status === 'ready' && availability.data.enabled
      }
    />
  );
}

import React from 'react';
import { Mars, Venus, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GenderIconProps {
  gender?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * GenderIcon Component
 * Displays gender-specific icon with appropriate color
 * - Male: Blue Mars icon
 * - Female: Pink Venus icon
 * - Unknown: Gray User icon
 */
export default function GenderIcon({
  gender,
  size = 'md',
  className,
}: GenderIconProps) {
  const t = useTranslations('common.genderLabels');
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const iconClass = `${sizeClasses[size]} ${className || ''}`.trim();

  if (gender === 'male') {
    return (
      <div title={t('male')}>
        <Mars className={`${iconClass} text-blue-600`} />
      </div>
    );
  } else if (gender === 'female') {
    return (
      <div title={t('female')}>
        <Venus className={`${iconClass} text-pink-600`} />
      </div>
    );
  }

  return (
    <div title={t('unknown')}>
      <User className={`${iconClass} text-gray-400`} />
    </div>
  );
}

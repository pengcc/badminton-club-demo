import React from 'react';
import { Mars, Venus, User } from 'lucide-react';

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
export default function GenderIcon({ gender, size = 'md', className }: GenderIconProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  const iconClass = `${sizeClasses[size]} ${className || ''}`.trim();

  if (gender === 'male') {
    return (
      <div title="Male">
        <Mars className={`${iconClass} text-blue-600`} />
      </div>
    );
  } else if (gender === 'female') {
    return (
      <div title="Female">
        <Venus className={`${iconClass} text-pink-600`} />
      </div>
    );
  }

  return (
    <div title="Unknown">
      <User className={`${iconClass} text-gray-400`} />
    </div>
  );
}

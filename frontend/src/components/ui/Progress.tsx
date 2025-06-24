import React from 'react';
import { cn } from '@/utils/cn';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
}

export function Progress({
  value,
  max = 100,
  className,
  size = 'md',
  variant = 'default',
  showPercentage = false,
}: ProgressProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full bg-gray-200 rounded-full overflow-hidden',
          {
            'h-1': size === 'sm',
            'h-2': size === 'md',
            'h-3': size === 'lg',
          }
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-in-out rounded-full',
            {
              'bg-blue-600': variant === 'default',
              'bg-green-600': variant === 'success',
              'bg-yellow-600': variant === 'warning',
              'bg-red-600': variant === 'error',
            }
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>{percentage}%</span>
        </div>
      )}
    </div>
  );
}
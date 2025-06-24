import React from 'react';
import { cn } from '@/utils/cn';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface AlertProps {
  variant: 'success' | 'warning' | 'info' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  actions?: React.ReactNode;
}

const alertVariants = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: CheckCircleIcon,
    iconColor: 'text-green-400',
    titleColor: 'text-green-800',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: ExclamationTriangleIcon,
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-800',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: InformationCircleIcon,
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-800',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: XCircleIcon,
    iconColor: 'text-red-400',
    titleColor: 'text-red-800',
  },
};

export function Alert({
  variant,
  title,
  children,
  onClose,
  className,
  actions,
}: AlertProps) {
  const config = alertVariants[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'border rounded-md p-4',
        config.container,
        className
      )}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={cn('h-5 w-5', config.iconColor)} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={cn('text-sm font-medium', config.titleColor)}>
              {title}
            </h3>
          )}
          <div className={cn('text-sm', title && 'mt-2')}>
            {children}
          </div>
          {actions && (
            <div className="mt-4">
              {actions}
            </div>
          )}
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variant === 'success' && 'text-green-500 hover:bg-green-100 focus:ring-green-600',
                  variant === 'warning' && 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
                  variant === 'info' && 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600',
                  variant === 'error' && 'text-red-500 hover:bg-red-100 focus:ring-red-600'
                )}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import React from 'react';
import { cn } from '@/utils/cn';
import { CheckIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';

export interface Step {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  required?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onStepClick?: (stepId: string) => void;
}

const statusIcons = {
  pending: ClockIcon,
  in_progress: ClockIcon,
  completed: CheckIcon,
  error: ExclamationTriangleIcon,
};

const statusColors = {
  pending: 'text-gray-400 border-gray-300',
  in_progress: 'text-blue-600 border-blue-600',
  completed: 'text-green-600 border-green-600 bg-green-600',
  error: 'text-red-600 border-red-600',
};

export function Stepper({
  steps,
  currentStep,
  orientation = 'horizontal',
  className,
  onStepClick,
}: StepperProps) {
  const isVertical = orientation === 'vertical';

  return (
    <div className={cn(
      isVertical ? 'flex flex-col space-y-4' : 'flex items-center justify-between',
      className
    )}>
      {steps.map((step, index) => {
        const StatusIcon = statusIcons[step.status];
        const isLast = index === steps.length - 1;
        const isCurrent = step.id === currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center',
              isVertical ? 'w-full' : 'flex-1',
              onStepClick && 'cursor-pointer'
            )}
            onClick={() => onStepClick?.(step.id)}
          >
            <div className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                  statusColors[step.status],
                  step.status === 'completed' && 'text-white',
                  isCurrent && 'ring-2 ring-blue-200'
                )}
              >
                {step.status === 'completed' ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <StatusIcon className="w-4 h-4" />
                )}
              </div>
              
              <div className={cn(
                'ml-3',
                isVertical ? 'flex-1' : 'hidden sm:block'
              )}>
                <div className={cn(
                  'text-sm font-medium',
                  step.status === 'completed' ? 'text-green-600' :
                  step.status === 'error' ? 'text-red-600' :
                  isCurrent ? 'text-blue-600' : 'text-gray-500'
                )}>
                  {step.title}
                  {step.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                {step.description && (
                  <div className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </div>

            {!isLast && (
              <div className={cn(
                isVertical 
                  ? 'w-px h-6 bg-gray-300 ml-4 mt-2' 
                  : 'flex-1 h-px bg-gray-300 mx-4 hidden sm:block'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
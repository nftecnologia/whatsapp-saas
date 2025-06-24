import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { EyeIcon, EyeSlashIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { Input, InputProps } from './Input';

interface SecureInputProps extends Omit<InputProps, 'type'> {
  showToggle?: boolean;
  maskWhenHidden?: boolean;
  allowCopy?: boolean;
  onCopy?: () => void;
}

export function SecureInput({
  showToggle = true,
  maskWhenHidden = true,
  allowCopy = false,
  onCopy,
  className,
  value,
  ...props
}: SecureInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const handleCopy = async () => {
    if (value && typeof value === 'string') {
      try {
        await navigator.clipboard.writeText(value);
        onCopy?.();
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const getDisplayValue = () => {
    if (!value || typeof value !== 'string') return value;
    
    if (isVisible) return value;
    
    if (maskWhenHidden) {
      return value.length > 8 
        ? `${value.substring(0, 4)}${'•'.repeat(value.length - 8)}${value.substring(value.length - 4)}`
        : '•'.repeat(value.length);
    }
    
    return value;
  };

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? 'text' : 'password'}
        value={getDisplayValue()}
        className={cn('pr-16', className)}
      />
      
      <div className="absolute inset-y-0 right-0 flex items-center space-x-1 pr-3">
        {allowCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy to clipboard"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
          </button>
        )}
        
        {showToggle && (
          <button
            type="button"
            onClick={toggleVisibility}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title={isVisible ? 'Hide' : 'Show'}
          >
            {isVisible ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
import React from 'react';
import { cn } from '@/utils/cn';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className={cn('min-w-full divide-y divide-gray-300', className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <thead className={cn('bg-gray-50', className)}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={cn('divide-y divide-gray-200 bg-white', className)}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, onClick }: TableRowProps) {
  return (
    <tr
      className={cn(
        onClick && 'cursor-pointer hover:bg-gray-50',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className }: TableCellProps) {
  return (
    <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>
      {children}
    </td>
  );
}
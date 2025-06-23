import { format, parseISO, formatDistanceToNow } from 'date-fns';

export const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'dd/MM/yyyy');
};

export const formatDateTime = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'dd/MM/yyyy HH:mm');
};

export const formatTimeAgo = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
};

export const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
};

export const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
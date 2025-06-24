import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '@/types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: string
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(error && { error }),
  });
};

export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message: string = 'Success'
): Response<PaginatedResponse<T>> => {
  const pages = Math.ceil(pagination.total / pagination.limit);
  
  return res.status(200).json({
    data,
    pagination: {
      ...pagination,
      pages,
    },
  });
};

export const createResponse = <T>(
  success: boolean,
  data?: T,
  message: string = '',
  error?: string
): ApiResponse<T> => {
  return {
    success,
    data,
    message,
    ...(error && { error }),
  };
};
import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const ragQuery = async (question) => {
  const response = await apiClient.post(ENDPOINTS.ragQuery, { question });
  return response.data?.data;
};
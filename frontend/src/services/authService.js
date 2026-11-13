import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const login = async (payload) => {
  const response = await apiClient.post(ENDPOINTS.login, payload);
  return response.data?.data;
};

export const register = async (payload) => {
  const response = await apiClient.post(ENDPOINTS.register, payload);
  return response.data?.data;
};

export const getProfile = async () => {
  const response = await apiClient.get(ENDPOINTS.profile);
  return response.data?.data;
};

export const updateProfile = async (payload) => {
  const response = await apiClient.patch(ENDPOINTS.profile, payload);
  return response.data?.data;
};
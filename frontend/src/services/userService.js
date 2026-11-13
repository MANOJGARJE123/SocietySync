import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const getUsers = async () => {
  const r = await apiClient.get(ENDPOINTS.users);
  return r.data?.data || [];
};
export const updateUserRole = async (id, role) => {
  const r = await apiClient.patch(`${ENDPOINTS.users}/${id}/role`, { role });
  return r.data?.data;
};
export const deleteUser = async (id) => {
  const r = await apiClient.delete(`${ENDPOINTS.users}/${id}`);
  return r.data?.data;
};
export const getActiveUserCount = async () => {
  const r = await apiClient.get(`${ENDPOINTS.users}/count`);
  return r.data?.data ?? 0;
};

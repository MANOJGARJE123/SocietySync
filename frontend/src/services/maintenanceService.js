import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';
import { ROLES } from '../constants/app';

export const createMaintenance = async (payload) => {
  const response = await apiClient.post(ENDPOINTS.maintenanceDues, payload);
  return response.data?.data;
};

export const getMaintenance = async (role) => {
  const isManager = [ROLES.ADMIN, ROLES.CHAIRMAN].includes(role);
  const endpoint = isManager ? ENDPOINTS.maintenance : `${ENDPOINTS.maintenance}/my`;
  const response = await apiClient.get(endpoint);
  return response.data?.data || [];
};

export const payMaintenance = async (id, payload) => {
  const response = await apiClient.post(`${ENDPOINTS.maintenance}/${id}/pay`, payload);
  return response.data?.data;
};

export const notifyMaintenance = async (id) => {
  const response = await apiClient.post(`${ENDPOINTS.maintenance}/${id}/notify`);
  return response.data?.data;
};

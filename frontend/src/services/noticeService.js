import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const getNotices = async () => {
  const r = await apiClient.get(ENDPOINTS.notices);
  return r.data?.data || [];
};
export const createNotice = async (payload) => {
  const r = await apiClient.post(ENDPOINTS.notices, payload);
  return r.data?.data;
};
export const editNotice = async (id, payload) => {
  const r = await apiClient.patch(`${ENDPOINTS.notices}/${id}`, payload);
  return r.data?.data;
};
export const deleteNotice = async (id) => {
  const r = await apiClient.delete(`${ENDPOINTS.notices}/${id}`);
  return r.data?.data;
};

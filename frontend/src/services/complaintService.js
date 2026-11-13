import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';
import { ROLES } from '../constants/app';

export const createComplaint = async (payload) => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  if (payload.photo) {
    formData.append('photo', payload.photo.file || {
      uri: payload.photo.uri,
      name: payload.photo.fileName || `complaint-photo.${payload.photo.extension || 'jpg'}`,
      type: payload.photo.mimeType || 'image/jpeg',
    });
  }
  const r = await apiClient.post(ENDPOINTS.complaints, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data?.data;
};
export const getComplaints = async (role) => {
  const endpoint = (role === ROLES.ADMIN || role === ROLES.SECRETARY) ? ENDPOINTS.complaints : ENDPOINTS.myComplaints;
  const r = await apiClient.get(endpoint);
  return r.data?.data || [];
};
export const updateComplaintStatus = async (id, status) => {
  const r = await apiClient.patch(`${ENDPOINTS.complaints}/${id}/status`, { status });
  return r.data?.data;
};
export const editComplaint = async (id, payload) => {
  const r = await apiClient.patch(`${ENDPOINTS.complaints}/${id}`, payload);
  return r.data?.data;
};
export const deleteComplaint = async (id) => {
  const r = await apiClient.delete(`${ENDPOINTS.complaints}/${id}`);
  return r.data?.data;
};
// SECURITY FIX: images served through authenticated API route
export const getComplaintImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const filename = imageUrl.split('/').pop();
  return `${apiClient.defaults.baseURL}${ENDPOINTS.complaints}/attachment/${filename}`;
};

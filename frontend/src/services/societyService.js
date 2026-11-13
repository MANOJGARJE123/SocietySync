import apiClient from './apiClient';
import { ENDPOINTS } from '../constants/api';

export const createSociety = async (payload) => {
  const response = await apiClient.post(ENDPOINTS.societies, payload);
  return response.data?.data;
};

export const getSocieties = async () => {
  const response = await apiClient.get(ENDPOINTS.societies);
  return response.data?.data || [];
};

export const getSociety = async (id) => {
  const response = await apiClient.get(`${ENDPOINTS.societies}/${id}`);
  return response.data?.data;
};

export const addWing = async (societyId, payload) => {
  const response = await apiClient.post(`${ENDPOINTS.societies}/${societyId}/wings`, payload);
  return response.data?.data;
};

export const getWingsBySociety = async (societyId) => {
  const response = await apiClient.get(`${ENDPOINTS.wings}/society/${societyId}`);
  return response.data?.data || [];
};

export const assignChairman = async (wingId, chairmanId) => {
  const response = await apiClient.patch(`${ENDPOINTS.wings}/${wingId}/assign-chairman`, {
    chairmanId
  });
  return response.data?.data;
};

export const assignChairmanByContact = async (wingId, contact) => {
  const response = await apiClient.patch(`${ENDPOINTS.wings}/${wingId}/assign-chairman-by-contact`, {
    contact
  });
  return response.data?.data;
};

export const requestJoinWing = async (wingId) => {
  const response = await apiClient.post(`${ENDPOINTS.wings}/${wingId}/join-request`);
  return response.data?.data;
};

export const getWingRequests = async (wingId) => {
  const response = await apiClient.get(`${ENDPOINTS.wings}/${wingId}/requests`);
  return response.data?.data || [];
};

export const getWingMembers = async (wingId) => {
  const response = await apiClient.get(`${ENDPOINTS.wings}/${wingId}/members`);
  return response.data?.data || [];
};

export const approveWingRequest = async (wingId, userId) => {
  const response = await apiClient.patch(`${ENDPOINTS.wings}/${wingId}/requests/${userId}/approve`);
  return response.data?.data;
};

export const rejectWingRequest = async (wingId, userId) => {
  const response = await apiClient.patch(`${ENDPOINTS.wings}/${wingId}/requests/${userId}/reject`);
  return response.data?.data;
};

export const removeWingMember = async (wingId, userId) => {
  const response = await apiClient.patch(`${ENDPOINTS.wings}/${wingId}/members/${userId}/remove`);
  return response.data?.data;
};

export const registerResident = async (payload) => {
  const response = await apiClient.post(ENDPOINTS.residents, payload);
  return response.data?.data;
};

export const deleteSociety = async (societyId) => {
  const response = await apiClient.delete(`${ENDPOINTS.societies}/${societyId}`);
  return response.data?.data;
};

export const updateRole = async (userId, role) => {
  const response = await apiClient.patch(`${ENDPOINTS.users}/${userId}/role`, { role });
  return response.data?.data;
};

export const deleteUser = async (userId) => {
  const response = await apiClient.delete(`${ENDPOINTS.users}/${userId}`);
  return response.data?.data;
};

// Alias for HomeScreen usage
export const getSocietyDetails = getSociety;

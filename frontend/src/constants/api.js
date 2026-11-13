import { Platform } from 'react-native';

const defaultHost = Platform.select({ android: '10.0.2.2', ios: 'localhost', default: 'localhost' });
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${defaultHost}:5050/api`;
export const ASSET_BASE_URL = BASE_URL.replace(/\/api$/, '');

export const ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
  users: '/users',
  profile: '/users/profile',
  residents: '/users/residents',
  notices: '/notices',
  complaints: '/complaints',
  myComplaints: '/complaints/my',
  maintenance: '/maintenance',
  maintenanceDues: '/maintenance/dues',
  ragQuery: '/rag/query',
  societies: '/societies',
  wings: '/wings',
};

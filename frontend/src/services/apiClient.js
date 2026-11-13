import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants/api';
import { TOKEN_KEY } from '../constants/app';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// Normalize error responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const msg = error.response.data?.message || `Server error (${error.response.status})`;
      const normalizedError = new Error(msg);
      normalizedError.statusCode = error.response.status;
      normalizedError.data = error.response.data;
      return Promise.reject(normalizedError);
    }
    if (error.request) return Promise.reject(new Error('No response from server. Check your connection.'));
    return Promise.reject(error);
  }
);

export default apiClient;

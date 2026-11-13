import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TOKEN_KEY, USER_KEY } from '../constants/app';
import { getProfile, login, register, updateProfile } from '../services/authService';
import { getErrorMessage } from '../utils/error';

const AuthContext = createContext(null);

const normalizeUser = (user) => {
  if (!user) return user;
  const resolvedId = user._id || user.id;
  return {
    ...user,
    _id: resolvedId,
    id: resolvedId
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(token);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(USER_KEY);

        if (!storedToken) return;

        setToken(storedToken);

        if (storedUser) {
          setUser(normalizeUser(JSON.parse(storedUser)));
        }

        const freshProfile = await getProfile();
        const normalizedProfile = normalizeUser(freshProfile);
        setUser(normalizedProfile);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedProfile));
      } catch (error) {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
        setToken('');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const handleAuthSuccess = async (authData) => {
    const normalizedUser = normalizeUser(authData.user);
    await AsyncStorage.setItem(TOKEN_KEY, authData.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    setToken(authData.token);
    setUser(normalizedUser);
  };

  const signIn = async (payload) => {
    const authData = await login(payload);
    await handleAuthSuccess(authData);
    return authData;
  };

  const signUp = async (payload) => {
    const authData = await register(payload);
    await handleAuthSuccess(authData);
    return authData;
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken('');
    setUser(null);
  };

  const refreshProfile = async () => {
    const profile = await getProfile();
    const normalizedProfile = normalizeUser(profile);
    setUser(normalizedProfile);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedProfile));
    return normalizedProfile;
  };

  const saveProfile = async (payload) => {
    try {
      const updated = await updateProfile(payload);
      const normalizedUser = normalizeUser(updated);
      setUser(normalizedUser);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to update profile'));
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      saveProfile
    }),
    [user, token, isLoading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

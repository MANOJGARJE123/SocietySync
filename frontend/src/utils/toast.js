import React from 'react';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

export const showSuccess = (title, message) => {
  Toast.show({ type: 'success', text1: title, text2: message, position: 'bottom' });
};

export const showError = (title, message) => {
  Toast.show({ type: 'error', text1: title, text2: message, position: 'bottom' });
};

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#2C9B6F', borderRadius: 14, borderLeftWidth: 5 }}
      text1Style={{ fontWeight: '800', fontSize: 14 }}
      text2Style={{ fontSize: 12, color: '#3F5778' }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#D1495B', borderRadius: 14, borderLeftWidth: 5 }}
      text1Style={{ fontWeight: '800', fontSize: 14 }}
      text2Style={{ fontSize: 12, color: '#7A2F3A' }}
    />
  )
};

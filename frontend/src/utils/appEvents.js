const listeners = {
  complaintCreated: new Set()
};

export const APP_EVENTS = {
  COMPLAINT_CREATED: 'complaintCreated'
};

export const emitAppEvent = (eventName, payload) => {
  const eventListeners = listeners[eventName];
  if (!eventListeners) return;
  eventListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_error) {
      // Ignore listener errors to avoid breaking event propagation.
    }
  });
};

export const subscribeAppEvent = (eventName, callback) => {
  const eventListeners = listeners[eventName];
  if (!eventListeners || typeof callback !== 'function') {
    return () => {};
  }
  eventListeners.add(callback);
  return () => {
    eventListeners.delete(callback);
  };
};

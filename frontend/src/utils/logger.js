// utils/logger.js
export const logEvent = (msg, setLog) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`${time} – ${msg}`, ...prev]);
  };
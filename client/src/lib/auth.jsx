import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(() => readJson('bb_staff'));
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem('bb_staff_token'));

  const value = useMemo(
    () => ({
      staff,
      staffToken,
      setStaffSession: (token, account) => {
        localStorage.setItem('bb_staff_token', token);
        localStorage.setItem('bb_staff', JSON.stringify(account));
        // Clear any leftover customer-app session from older builds
        localStorage.removeItem('bb_customer_token');
        localStorage.removeItem('bb_customer');
        setStaffToken(token);
        setStaff(account);
      },
      clearStaffSession: () => {
        localStorage.removeItem('bb_staff_token');
        localStorage.removeItem('bb_staff');
        setStaffToken(null);
        setStaff(null);
      },
    }),
    [staff, staffToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

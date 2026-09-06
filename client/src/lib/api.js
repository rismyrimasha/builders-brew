import axios from 'axios';

// Dev / same-origin deploy: leave VITE_API_URL unset — requests hit '/api' on the
// current origin (Vite proxies it to the server, or Express serves both).
// Split deploy (client and API on different hosts): set VITE_API_URL at build time
// to the full API base, e.g. https://api.buildersbrew.example/api
const baseURL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const staffToken = localStorage.getItem('bb_staff_token');
  if (staffToken) {
    config.headers.Authorization = `Bearer ${staffToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isLogin = url.includes('/auth/staff/login');
      if (!isLogin) {
        localStorage.removeItem('bb_staff_token');
        localStorage.removeItem('bb_staff');
        localStorage.removeItem('bb_customer_token');
        localStorage.removeItem('bb_customer');
        const adminPath = window.location.pathname.startsWith('/admin');
        window.location.assign(adminPath ? '/admin/login' : '/staff/login');
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

export default api;

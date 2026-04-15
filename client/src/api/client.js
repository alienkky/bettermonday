import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally (skip login endpoints — they return 401 for bad credentials)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isLoginReq = url.includes('/auth/customer/login') || url.includes('/auth/admin/login') || url.includes('/auth/admin/register') || url.includes('/auth/master/login');
    if (err.response?.status === 401 && !isLoginReq) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  // Customer
  register: (data) => api.post('/auth/customer/register', data),
  customerLogin: (data) => api.post('/auth/customer/login', data),
  customerLogout: () => api.post('/auth/customer/logout'),
  forgotPassword: (data) => api.post('/auth/customer/forgot-password', data),
  resetPassword: (data) => api.post('/auth/customer/reset-password', data),
  // Admin
  adminRegister: (data) => api.post('/auth/admin/register', data),
  adminLogin: (data) => api.post('/auth/admin/login', data),
  adminLogout: () => api.post('/auth/admin/logout'),
  // Master
  masterLogin: (data) => api.post('/auth/master/login', data),
  masterLogout: () => api.post('/auth/master/logout'),
  // Shared
  me: () => api.get('/auth/me'),
};

// Spaces
export const spacesApi = {
  create: (data) => api.post('/spaces', data),
  list: () => api.get('/spaces'),
  get: (id) => api.get(`/spaces/${id}`),
  update: (id, data) => api.put(`/spaces/${id}`, data),
  delete: (id) => api.delete(`/spaces/${id}`),
};

// Items
export const itemsApi = {
  list: (params) => api.get('/items', { params }),
  listAll: () => api.get('/items/all'),
  create: (formData) => api.post('/items', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/items/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggle: (id) => api.patch(`/items/${id}/toggle`),
  bulk: (data) => api.post('/items/bulk', data),
  exportExcel: () => api.get('/items/export', { responseType: 'blob' }),
  importExcel: (formData) => api.post('/items/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  seedFromMarket: (force) => api.post('/items/seed-from-market', { force }),
};

// Categories
export const categoriesApi = {
  list: (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  delete: (id, force) => api.delete(`/categories/${id}`, { params: force ? { force: 'true' } : {} }),
};

// Placements
export const placementsApi = {
  list: (spaceId) => api.get('/placements', { params: { spaceId } }),
  sync: (spaceId, placements) => api.post('/placements/sync', { spaceId, placements }),
};

// Estimates
export const estimatesApi = {
  create: (data) => api.post('/estimates', data),
  list: () => api.get('/estimates'),
  get: (id) => api.get(`/estimates/${id}`),
  submit: (id, data) => api.patch(`/estimates/${id}/submit`, data),
};

// Admin
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  estimates: (params) => api.get('/admin/estimates', { params }),
  updateEstimate: (id, data) => api.patch(`/admin/estimates/${id}`, data),
  customers: (params) => api.get('/admin/customers', { params }),
  updateCustomer: (id, data) => api.patch(`/admin/customers/${id}`, data),
  customerEstimates: (id) => api.get(`/admin/customers/${id}/estimates`),
  customerConsentLogs: (id) => api.get(`/admin/customers/${id}/consent-logs`),
  anonymizeCustomer: (id) => api.post(`/admin/customers/${id}/anonymize`),
};

// Upload
export const uploadApi = {
  parseFloorplan: (formData) =>
    api.post('/upload/floorplan', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),
};

// Versions
export const versionsApi = {
  current: () => api.get('/versions/current'),
  list: () => api.get('/versions'),
  release: (data) => api.post('/versions/release', data),
};

// Market Prices (시세 트래킹)
export const marketPricesApi = {
  list: (params) => api.get('/market-prices', { params }),
  create: (data) => api.post('/market-prices', data),
  update: (id, data) => api.put(`/market-prices/${id}`, data),
  delete: (id) => api.delete(`/market-prices/${id}`),
  seed: (force) => api.post('/market-prices/seed', { force }),
  refresh: () => api.post('/market-prices/refresh'),
  compare: () => api.get('/market-prices/compare'),
  link: (id, itemId) => api.patch(`/market-prices/${id}/link`, { itemId }),
  unlink: (id) => api.patch(`/market-prices/${id}/link`, { itemId: null }),
  syncToItems: (data) => api.post('/market-prices/sync-to-items', data),
  forceSyncAll: (data) => api.post('/market-prices/force-sync-all', data),
  pendingItems: () => api.get('/market-prices/pending-items'),
  importFromItems: (data) => api.post('/market-prices/import-from-items', data),
  applyToItem: (id, data) => api.post(`/market-prices/${id}/apply-to-item`, data || {}),
  exportExcel: (params) => api.get('/market-prices/export', { params, responseType: 'blob' }),
};

// Brand Settings
export const brandApi = {
  get: () => api.get('/admin/brand'),
  update: (formData) => api.patch('/admin/brand', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Master
export const masterApi = {
  dashboard: () => api.get('/master/dashboard'),
  // Companies
  companies: (params) => api.get('/master/companies', { params }),
  createCompany: (data) => api.post('/master/companies', data),
  updateCompany: (id, data) => api.patch(`/master/companies/${id}`, data),
  deleteCompany: (id) => api.delete(`/master/companies/${id}`),
  resetCompanyPassword: (id, data) => api.post(`/master/companies/${id}/reset-password`, data),
  // Estimates
  estimates: (params) => api.get('/master/estimates', { params }),
  updateEstimate: (id, data) => api.patch(`/master/estimates/${id}`, data),
  // Customers
  customers: (params) => api.get('/master/customers', { params }),
  // Company Brand
  getCompanyBrand: (id) => api.get(`/master/companies/${id}/brand`),
  updateCompanyBrand: (id, formData) => api.patch(`/master/companies/${id}/brand`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

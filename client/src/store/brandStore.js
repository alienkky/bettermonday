import { create } from 'zustand';
import { brandApi } from '../api/client';

const useBrandStore = create((set, get) => ({
  brand: null,
  loading: false,
  _fetchedForUser: null, // track which user the brand was fetched for

  fetchBrand: async (forceRefresh = false) => {
    // Get current user from localStorage to detect user changes
    const storedUser = localStorage.getItem('user');
    const currentUserId = storedUser ? JSON.parse(storedUser)?.id : null;
    const prev = get()._fetchedForUser;

    // Skip if already loaded for the same user (unless forced)
    if (!forceRefresh && get().brand && prev === currentUserId) return;

    set({ loading: true });
    try {
      const res = await brandApi.get();
      set({ brand: res.data, loading: false, _fetchedForUser: currentUserId });
      get().applyCSS(res.data);
    } catch {
      set({ loading: false });
    }
  },

  setBrand: (brand) => {
    set({ brand });
    get().applyCSS(brand);
  },

  clearBrand: () => {
    set({ brand: null, _fetchedForUser: null });
  },

  applyCSS: (b) => {
    if (!b) return;
    const root = document.documentElement;
    root.style.setProperty('--color-primary', b.primaryColor);
    root.style.setProperty('--color-secondary', b.secondaryColor);
    root.style.setProperty('--color-accent', b.accentColor);
    root.style.setProperty('--color-danger', b.dangerColor);
    root.style.setProperty('--color-header-bg', b.headerBg);
    root.style.setProperty('--color-header-text', b.headerTextColor);
    root.style.setProperty('--color-body-bg', b.bodyBg);
    root.style.setProperty('--brand-radius', b.borderRadius + 'px');

    // Update favicon if set
    if (b.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = b.faviconUrl;
    }

    // Update document title
    if (b.brandName) {
      document.title = b.brandName;
    }
  },
}));

export default useBrandStore;

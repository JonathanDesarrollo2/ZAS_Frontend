import { create } from 'zustand';

export interface CartItem {
  productId: string;
  product_name: string;
  price: number;
  quantity: number;
  restaurant_id: string;   // ← NUEVO
  options?: any[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find(i => i.productId === item.productId);
    if (existing) {
      set({
        items: get().items.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      });
    } else {
      set({ items: [...get().items, item] });
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.productId !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map(i =>
        i.productId === productId ? { ...i, quantity } : i
      ),
    });
  },

  clearCart: () => set({ items: [] }),

  subtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
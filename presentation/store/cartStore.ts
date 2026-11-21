// LEIDO
import { create } from 'zustand';

export interface CartOption {
  id: string;
  group_id: string;
  group_name: string;
  name: string;
  extra_price: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  product_name: string;
  base_price: number;
  price: number;
  quantity: number;
  restaurant_id: string;
  options: CartOption[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cartItemId'> & { cartItemId?: string }) => 'added' | 'different_restaurant' | 'quantity_limit';
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const getCartItemId = (productId: string, optionIds: string[]) =>
  `${productId}:${[...optionIds].sort().join(',')}`;

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const items = get().items;
    if (items.some((existing) => existing.restaurant_id !== item.restaurant_id)) return 'different_restaurant';

    const cartItemId = item.cartItemId || getCartItemId(item.productId, item.options.map((option) => option.id));
    const existing = items.find((current) => current.cartItemId === cartItemId);
    if (existing) {
      if (existing.quantity + item.quantity > 99) return 'quantity_limit';
      set({
        items: items.map((current) =>
          current.cartItemId === cartItemId
            ? { ...current, quantity: current.quantity + item.quantity }
            : current
        ),
      });
    } else {
      if (item.quantity > 99) return 'quantity_limit';
      set({ items: [...items, { ...item, cartItemId }] });
    }
    return 'added';
  },

  removeItem: (cartItemId) => {
    set({ items: get().items.filter((item) => item.cartItemId !== cartItemId) });
  },

  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(cartItemId);
      return;
    }
    if (quantity > 99) return;
    set({
      items: get().items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      ),
    });
  },

  clearCart: () => set({ items: [] }),

  subtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
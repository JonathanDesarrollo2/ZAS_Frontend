import { useAuthStore } from "../store/AuthStore";


export function useAuth() {
  const store = useAuthStore();
  return {
    ...store,
    isDriver: store.user?.nivel === 2,
    isPassenger: store.user?.nivel === 3,
    isAdmin: store.user?.nivel === 1,
  };
}
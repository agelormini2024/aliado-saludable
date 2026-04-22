/**
 * Store de UI — estado de interfaz que no pertenece al servidor.
 *
 * Por ejemplo: sidebar abierto/cerrado en mobile, modales temporales,
 * preferencias de visualización que no necesitan persistencia.
 *
 * A diferencia de auth.store.ts, este store NO usa persist — el estado
 * se resetea con cada carga de página, lo cual es el comportamiento correcto
 * para cosas como "sidebar abierto en mobile".
 */
import { create } from "zustand";

interface UIState {
  /** Controla si el cajón del sidebar está visible en mobile */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

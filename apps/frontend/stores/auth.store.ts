/**
 * Store de autenticación — gestiona tokens JWT y datos del usuario autenticado.
 *
 * Usa Zustand con persist para guardar el estado en localStorage bajo la
 * clave "aliado-auth". El accessToken es la fuente de verdad para saber
 * si hay sesión activa.
 *
 * Ciclo de vida de tokens:
 * - accessToken  : corto plazo (15 min), va en cada request como Bearer
 * - refreshToken : largo plazo (7 días), se usa para rotar el accessToken
 *
 * El DashboardLayout lee este store para implementar el auth guard.
 * El interceptor de Axios (lib/api.ts) lo lee para inyectar el Bearer token.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Subconjunto de campos del Usuario que se guarda en el store de sesión */
export interface AuthUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: "USUARIO" | "COACH" | "ADMIN";
  altura?: number | null;
  meta?: number | null;
  coachId?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: AuthUsuario | null;
  /** Guarda los tokens recibidos del backend tras login o refresh */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Guarda los datos del usuario autenticado (obtenidos de GET /usuarios/me) */
  setUsuario: (usuario: AuthUsuario) => void;
  /** Limpia toda la sesión — se llama en logout */
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setUsuario: (usuario) => set({ usuario }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, usuario: null }),
    }),
    {
      name: "aliado-auth",
    },
  ),
);

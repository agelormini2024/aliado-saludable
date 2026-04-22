/**
 * Cliente HTTP configurado para comunicarse con el backend NestJS.
 *
 * El interceptor de request lee el accessToken desde el localStorage
 * (donde lo persiste Zustand bajo "aliado-auth") y lo agrega como
 * header Authorization: Bearer <token> en cada request.
 *
 * Nota: el token también se puede pasar explícitamente en la config del request
 * (como hace LoginPage al buscar el perfil justo después de login, antes de
 * que Zustand termine de escribir en localStorage).
 *
 * En Fase 3 se agregará un interceptor de response para refrescar
 * automáticamente el accessToken cuando el servidor devuelva 401.
 */
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const stored = localStorage.getItem("aliado-auth");
  if (!stored) return config;

  try {
    const parsed = JSON.parse(stored) as {
      state: { accessToken: string | null };
    };
    if (parsed.state.accessToken) {
      config.headers.Authorization = `Bearer ${parsed.state.accessToken}`;
    }
  } catch {
    // Storage corrupto — no inyectamos token
  }

  return config;
});

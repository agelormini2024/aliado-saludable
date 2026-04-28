/**
 * CoachLayout — shell del panel de coach.
 *
 * Auth guard con dos niveles:
 * 1. Sin sesión     → redirige a /login
 * 2. Sesión activa pero rol ≠ COACH → redirige a /dashboard
 *
 * El check de `mounted` es idéntico al DashboardLayout: evita el flash de
 * hidratación porque Zustand devuelve estado inicial durante SSR.
 *
 * Estructura visual:
 * - CoachSidebar fijo 256px (desktop) | cajón deslizable (mobile)
 * - Botón hamburguesa inline en mobile (no hay MobileHeader separado)
 * - main: área de contenido con scroll propio y padding generoso
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";
import { CoachSidebar } from "@/components/coach/CoachSidebar";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const usuario = useAuthStore((s) => s.usuario);
  const { setSidebarOpen } = useUIStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Guard 1: sin sesión → login
  useEffect(() => {
    if (mounted && !accessToken) {
      router.push("/login");
    }
  }, [mounted, accessToken, router]);

  // Guard 2: sesión activa pero no es COACH → dashboard de usuario
  useEffect(() => {
    if (mounted && accessToken && usuario?.rol !== "COACH") {
      router.push("/dashboard");
    }
  }, [mounted, accessToken, usuario, router]);

  if (!mounted) return <CargandoSesion />;
  if (!accessToken || usuario?.rol !== "COACH") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <CoachSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile — solo visible en pantallas pequeñas */}
        <header className="flex items-center gap-4 border-b border-cream-dark bg-cream px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream-dark"
            aria-label="Abrir menú"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="font-heading italic text-lg font-semibold text-forest">
            Panel Coach
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

/** Pantalla de carga mientras Zustand hidrata el store desde localStorage */
function CargandoSesion() {
  return (
    <div className="flex h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        <p className="font-sans text-sm text-ink-muted">Cargando...</p>
      </div>
    </div>
  );
}

/**
 * DashboardLayout — shell del área autenticada.
 *
 * Auth guard: verifica que hay un accessToken en el store de Zustand antes
 * de renderizar el contenido. Si no hay sesión activa, redirige a /login.
 *
 * El check de `mounted` es necesario para evitar problemas de hidratación:
 * durante SSR, Zustand devuelve el estado inicial (accessToken = null).
 * Sin el check, el layout flashearía un redirect antes de que el cliente
 * hidrate el store desde localStorage.
 *
 * Estructura visual:
 * - Sidebar fijo 256px (desktop) | cajón deslizable (mobile)
 * - MobileHeader solo en pantallas < lg
 * - main: área de contenido con scroll propio y padding generoso
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  // Primer efecto: marcar que el componente está montado (y Zustand hidratado)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Segundo efecto: redirigir si no hay sesión una vez que Zustand está listo
  useEffect(() => {
    if (mounted && !accessToken) {
      router.push("/login");
    }
  }, [mounted, accessToken, router]);

  if (!mounted) {
    return <CargandoSesion />;
  }

  // accessToken es null y el router.push ya está en camino
  if (!accessToken) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
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

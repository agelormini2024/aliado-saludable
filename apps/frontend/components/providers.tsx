/**
 * Providers — wrapper raíz para todos los proveedores de estado global del cliente.
 *
 * Se monta una sola vez en el RootLayout (app/layout.tsx).
 * Incluye:
 * - QueryClientProvider (Tanstack Query): gestión de server state, caché, refetch
 * - ReactQueryDevtools: panel de debug solo en desarrollo
 *
 * Zustand no necesita un provider propio — los stores son módulos globales
 * que se consumen directamente con useAuthStore() y useUIStore() desde
 * cualquier Client Component.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * useState garantiza que el QueryClient se crea una sola vez por montaje
   * del componente, evitando que se reinicie en cada render.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto antes de re-fetch en background
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

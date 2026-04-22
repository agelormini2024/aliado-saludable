/**
 * Sidebar — navegación principal del área autenticada.
 *
 * Comportamiento responsive:
 * - Desktop (lg+): posición estática, 256px de ancho, siempre visible
 * - Mobile/tablet: posición fija, se desliza desde la izquierda al abrir.
 *   Un overlay oscuro cubre el contenido principal cuando está abierto.
 *
 * Diseño: fondo bosque (#1E5631), esquina derecha redondeada (rounded-r-3xl)
 * para un toque orgánico. El ítem activo muestra una barra ámbar a la izquierda.
 *
 * El store de UI (useUIStore) controla la apertura en mobile.
 * El store de auth (useAuthStore) provee los datos del usuario y el logout.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

/* ─── Iconos SVG ──────────────────────────────────────────────────────────── */

const IconDashboard = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M2 4a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm9 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V4zM2 13a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2v-3zm9 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z" />
  </svg>
);

const IconProgreso = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
  </svg>
);

const IconActividad = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
  </svg>
);

const IconAlimentacion = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M3 4a1 1 0 011-1h1v4.586l.293-.293a1 1 0 011.414 1.414L6 10.414V16a1 1 0 11-2 0v-5.586l-.707-.707A1 1 0 014 8.586V4a1 1 0 011-1zM9 3a1 1 0 00-1 1v4a3 3 0 003 3v5a1 1 0 102 0v-5a3 3 0 003-3V4a1 1 0 00-1-1 1 1 0 00-1 1v3h-4V4a1 1 0 00-1-1z" />
  </svg>
);

const IconChat = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
  </svg>
);

const IconContenido = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
  </svg>
);

const IconPerfil = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
);

/* ─── Configuración de navegación ─────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", Icon: IconDashboard },
  { label: "Progreso", href: "/progreso", Icon: IconProgreso },
  { label: "Actividad", href: "/actividad", Icon: IconActividad },
  { label: "Alimentación", href: "/alimentacion", Icon: IconAlimentacion },
  { label: "Chat IA", href: "/chat", Icon: IconChat },
  { label: "Contenido", href: "/contenido", Icon: IconContenido },
  { label: "Perfil", href: "/perfil", Icon: IconPerfil },
] as const;

/* ─── Componente ──────────────────────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const inicial = usuario?.nombre?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      {/* Overlay oscuro para mobile — cierra el sidebar al tocar fuera */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel del sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col
          bg-forest shadow-xl shadow-forest/30
          rounded-r-3xl
          transition-transform duration-300 ease-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="border-b border-white/10 px-6 pb-6 pt-7">
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="block"
          >
            <span className="font-heading italic text-2xl font-semibold leading-none tracking-tight text-cream">
              Aliado
            </span>
            <span className="mt-1 block font-sans text-[10px] uppercase tracking-[0.2em] text-forest-light">
              Saludable
            </span>
          </Link>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                  transition-all duration-150
                  ${
                    isActive
                      ? "bg-white/10 text-cream"
                      : "text-cream/55 hover:bg-white/5 hover:text-cream/85"
                  }
                `}
              >
                {/* Barra de ítem activo */}
                <span
                  className={`h-5 w-1 shrink-0 rounded-full transition-all ${isActive ? "bg-amber" : "bg-transparent"}`}
                />
                <span className="h-5 w-5 shrink-0">
                  <Icon />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sección del usuario */}
        <div className="border-t border-white/10 px-4 py-5">
          {usuario && (
            <div className="mb-3 flex items-center gap-3 px-2">
              {/* Avatar con inicial */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/20">
                <span className="font-sans text-sm font-semibold text-amber-light">
                  {inicial}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cream">
                  {usuario.nombre} {usuario.apellido}
                </p>
                <p className="truncate text-xs text-forest-light">
                  {usuario.email}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-cream/40 transition-all hover:bg-amber/10 hover:text-amber-light"
          >
            <span className="h-4 w-4 shrink-0">
              <IconLogout />
            </span>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

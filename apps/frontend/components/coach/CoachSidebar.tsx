/**
 * CoachSidebar — navegación principal del panel de coach.
 *
 * Diseño idéntico al Sidebar del dashboard (bg-forest, rounded-r-3xl, barra ámbar)
 * pero con ítems de navegación específicos del rol COACH.
 *
 * Responsive:
 * - Desktop (lg+): posición estática, 256px, siempre visible
 * - Mobile: posición fija, desliza desde la izquierda con overlay oscuro
 *
 * El badge "Coach" bajo el nombre diferencia visualmente este panel del dashboard de usuario.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

/* ─── Íconos ──────────────────────────────────────────────────────────────── */

const IconPacientes = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
      clipRule="evenodd"
    />
  </svg>
);

/* ─── Navegación del panel coach ──────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: "Mis Pacientes", href: "/coach/pacientes", Icon: IconPacientes },
] as const;

/* ─── Componente ──────────────────────────────────────────────────────────── */

export function CoachSidebar() {
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
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

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
        {/* Logo + badge de rol */}
        <div className="border-b border-white/10 px-6 pb-6 pt-7">
          <Link
            href="/coach/pacientes"
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
          {/* Badge que identifica visualmente el panel de coach */}
          <span className="mt-3 inline-flex items-center rounded-full bg-amber/15 px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-amber-light">
            Panel Coach
          </span>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/20">
                <span className="font-sans text-sm font-semibold text-amber-light">
                  {inicial}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cream">
                  {usuario.nombre} {usuario.apellido}
                </p>
                <p className="truncate text-xs text-forest-light">{usuario.email}</p>
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

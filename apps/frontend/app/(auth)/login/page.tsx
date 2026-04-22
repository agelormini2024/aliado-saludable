/**
 * LoginPage — formulario de inicio de sesión.
 *
 * Flujo de autenticación:
 * 1. POST /auth/login con { email, password } → { data: { accessToken, refreshToken } }
 * 2. GET /usuarios/me con el accessToken recién obtenido → perfil del usuario
 * 3. Guardar tokens y perfil en el store de Zustand (persiste a localStorage)
 * 4. Redirigir a /dashboard
 *
 * Si ya hay sesión activa (accessToken en el store), redirige directo a /dashboard.
 *
 * Validación del formulario: React Hook Form + Zod (client-side antes de enviar).
 * Los errores del backend (401, 409, etc.) se muestran en un banner rojo bajo el form.
 */
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import type { AuthUsuario } from "@/stores/auth.store";

/* ─── Schema de validación ────────────────────────────────────────────────── */

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type FormData = z.infer<typeof schema>;

/* ─── Tipos de respuesta del backend ─────────────────────────────────────── */

interface TokenResponse {
  data: { accessToken: string; refreshToken: string };
}

interface PerfilResponse {
  data: AuthUsuario;
}

/* ─── Componente ──────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUsuario, accessToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Si ya hay sesión activa, saltear el login
  useEffect(() => {
    if (accessToken) router.push("/dashboard");
  }, [accessToken, router]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      // 1 — Obtener tokens
      const loginRes = await api.post<TokenResponse>("/auth/login", data);
      const { accessToken: at, refreshToken: rt } = loginRes.data.data;
      setTokens(at, rt);

      // 2 — Obtener perfil con el token recién recibido (no esperamos a que
      //     Zustand escriba en localStorage, pasamos el token directamente)
      const perfilRes = await api.get<PerfilResponse>("/usuarios/me", {
        headers: { Authorization: `Bearer ${at}` },
      });
      setUsuario(perfilRes.data.data);

      router.push("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string | string[] } };
      };
      const msg = axiosErr.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg[0]
          : (msg ?? "Email o contraseña incorrectos. Revisá tus datos."),
      );
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="rounded-3xl border border-cream-dark/50 bg-white/75 px-8 py-10 shadow-xl shadow-forest/5 backdrop-blur-sm">
        {/* Encabezado */}
        <div className="mb-8">
          <span className="mb-3 inline-block font-sans text-xs font-semibold uppercase tracking-widest text-amber">
            Bienvenido
          </span>
          <h1 className="font-heading italic text-3xl font-semibold leading-tight text-forest">
            Es un gusto
            <br />
            verte de vuelta.
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              {...register("email")}
              className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-forest py-3 font-medium text-cream transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          ¿Primera vez por acá?{" "}
          <Link
            href="/register"
            className="font-medium text-forest underline underline-offset-2 transition-colors hover:text-forest-mid"
          >
            Creá tu cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

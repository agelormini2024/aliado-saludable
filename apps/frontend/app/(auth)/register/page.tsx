/**
 * RegisterPage — formulario de creación de cuenta.
 *
 * Flujo:
 * 1. POST /auth/register con { nombre, apellido, email, password }
 *    → { data: { accessToken, refreshToken } }
 * 2. GET /usuarios/me → perfil del usuario recién creado
 * 3. Guardar en Zustand → redirigir a /dashboard
 *
 * Validación: Zod confirma que las dos contraseñas coincidan antes de enviar.
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

/* ─── Schema ──────────────────────────────────────────────────────────────── */

const schema = z
  .object({
    nombre: z.string().min(2, "Nombre requerido"),
    apellido: z.string().min(2, "Apellido requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface TokenResponse {
  data: { accessToken: string; refreshToken: string };
}

interface PerfilResponse {
  data: AuthUsuario;
}

/* ─── Componente ──────────────────────────────────────────────────────────── */

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, setUsuario, accessToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (accessToken) router.push("/dashboard");
  }, [accessToken, router]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const { nombre, apellido, email, password } = data;
      const regRes = await api.post<TokenResponse>("/auth/register", {
        nombre,
        apellido,
        email,
        password,
      });
      const { accessToken: at, refreshToken: rt } = regRes.data.data;
      setTokens(at, rt);

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
          : (msg ?? "Error al crear la cuenta. Intentá de nuevo."),
      );
    }
  };

  return (
    <div className="w-full max-w-md px-4 py-8">
      <div className="rounded-3xl border border-cream-dark/50 bg-white/75 px-8 py-10 shadow-xl shadow-forest/5 backdrop-blur-sm">
        {/* Encabezado */}
        <div className="mb-8">
          <span className="mb-3 inline-block font-sans text-xs font-semibold uppercase tracking-widest text-amber">
            Nueva cuenta
          </span>
          <h1 className="font-heading italic text-3xl font-semibold leading-tight text-forest">
            Empezá tu
            <br />
            camino hoy.
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Nombre y apellido en dos columnas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="nombre"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                autoComplete="given-name"
                placeholder="Ana"
                {...register("nombre")}
                className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
              />
              {errors.nombre && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.nombre.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="apellido"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Apellido
              </label>
              <input
                id="apellido"
                type="text"
                autoComplete="family-name"
                placeholder="García"
                {...register("apellido")}
                className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
              />
              {errors.apellido && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.apellido.message}
                </p>
              )}
            </div>
          </div>

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
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              {...register("password")}
              className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Confirmá tu contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className="w-full rounded-xl border border-cream-dark bg-cream/30 px-4 py-3 text-ink placeholder-ink-muted/40 outline-none transition-all focus:border-forest focus:ring-2 focus:ring-forest/10"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.confirmPassword.message}
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
            {isSubmitting ? "Creando cuenta..." : "Crear mi cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-forest underline underline-offset-2 transition-colors hover:text-forest-mid"
          >
            Ingresá acá
          </Link>
        </p>
      </div>
    </div>
  );
}

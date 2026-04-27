/**
 * ChatPage — interfaz de conversación con el asistente IA de Aliado Saludable.
 *
 * El historial de mensajes se persiste en localStorage bajo la clave
 * "aliado-chat-history". Se carga al montar el componente y se actualiza
 * en cada cambio. Límite: últimos 100 mensajes para no saturar el storage.
 *
 * Cada request al backend es independiente: el contexto viene del RAG
 * (historial del usuario + artículos/documentos), no de los mensajes previos.
 *
 * Layout: área de mensajes scrollable (flex-1) + input fijo al fondo.
 */
"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useChatMutation, type ChatMessage } from "@/hooks/useChat";

/* ─── Persistencia en localStorage ────────────────────────────────────────── */

const STORAGE_KEY = "aliado-chat-history";

/** Máximo de mensajes almacenados — evita llenar el localStorage con sesiones largas */
const MAX_MENSAJES = 100;

/**
 * Lee el historial de mensajes desde localStorage.
 * Revive los campos `timestamp` (guardados como string ISO → Date).
 * Devuelve [] si no hay nada o si el JSON está corrupto.
 */
function leerHistorial(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Omit<ChatMessage, "timestamp"> & { timestamp: string }
    >;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

/**
 * Persiste el historial en localStorage.
 * Solo guarda los últimos MAX_MENSAJES para limitar el uso de storage.
 * Ignora errores silenciosamente (ej: modo privado sin storage, cuota llena).
 */
function guardarHistorial(mensajes: ChatMessage[]): void {
  try {
    const recientes = mensajes.slice(-MAX_MENSAJES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recientes));
  } catch {
    // localStorage no disponible o cuota excedida — no es crítico
  }
}

/* ─── Sugerencias de inicio ────────────────────────────────────────────────── */

/**
 * Preguntas de ejemplo que aparecen en el estado vacío.
 * Ayudan al usuario a entender para qué sirve el chat.
 */
const SUGERENCIAS = [
  "¿Cuánto bajé de peso este mes?",
  "¿Qué debería comer antes de entrenar?",
  "¿Cómo están mis medidas comparadas con el mes pasado?",
  "Dame consejos para reducir calorías sin pasar hambre",
  "¿Cuántas veces entrené esta semana?",
] as const;

/* ─── Íconos SVG ───────────────────────────────────────────────────────────── */

const IconEnviar = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
  </svg>
);

const IconBot = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L4 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-.254.145a1 1 0 11-.992-1.736l.23-.132-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.58V12a1 1 0 11-2 0v-1.42l-1.246-.712a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.42l1.246.712a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.42V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-.992 0l-1.735-.992a1 1 0 01-.372-1.364z"
      clipRule="evenodd"
    />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

/* ─── Componente: burbuja de mensaje ───────────────────────────────────────── */

/**
 * BurbujaMensaje — renderiza un mensaje del usuario o del asistente.
 *
 * Usuario: alineado a la derecha, fondo ámbar cálido.
 * Asistente: alineado a la izquierda, fondo blanco con borde bosque suave.
 * El texto del asistente respeta saltos de párrafo (whitespace-pre-wrap).
 */
function BurbujaMensaje({ mensaje }: { mensaje: ChatMessage }) {
  const isUser = mensaje.role === "user";

  return (
    <div
      className={`flex items-end gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar del asistente */}
      {!isUser && (
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest shadow-sm shadow-forest/20">
          <span className="h-4 w-4 text-cream">
            <IconBot />
          </span>
        </div>
      )}

      {/* Burbuja */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-sm bg-amber/15 text-ink"
            : "rounded-bl-sm border border-forest/10 bg-white/80 text-ink"
        }`}
      >
        {isUser ? (
          <p className="font-sans text-sm leading-relaxed">{mensaje.contenido}</p>
        ) : (
          /* El texto del asistente puede tener párrafos separados por \n\n */
          <div className="space-y-3">
            {mensaje.contenido.split("\n\n").map((parrafo, i) => (
              <p
                key={i}
                className="font-sans text-sm leading-relaxed whitespace-pre-wrap"
              >
                {parrafo}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Componente: indicador de escritura ───────────────────────────────────── */

/**
 * IndicadorEscritura — animación de "el asistente está escribiendo".
 * Tres puntos que se animan en secuencia para dar sensación de actividad.
 */
function IndicadorEscritura() {
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest shadow-sm shadow-forest/20">
        <span className="h-4 w-4 text-cream">
          <IconBot />
        </span>
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-forest/10 bg-white/80 px-4 py-3.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-forest/40"
              style={{
                animation: "bounce-gentle 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Componente: estado vacío ─────────────────────────────────────────────── */

/**
 * EstadoVacio — pantalla de bienvenida cuando no hay mensajes.
 * Muestra una invitación a escribir y sugerencias de preguntas.
 */
function EstadoVacio({ onSugerencia }: { onSugerencia: (texto: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      {/* Ícono central */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 shadow-inner">
        <span className="h-8 w-8 text-forest">
          <IconBot />
        </span>
      </div>

      {/* Titulares */}
      <h2 className="font-heading italic text-2xl font-semibold text-forest">
        ¿En qué te puedo ayudar?
      </h2>
      <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-ink-muted">
        Soy tu aliado de salud. Puedo contarte sobre tu progreso, ayudarte con
        dudas de nutrición y ejercicio, y acompañarte en el proceso.
      </p>

      {/* Sugerencias */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {SUGERENCIAS.map((sug) => (
          <button
            key={sug}
            onClick={() => onSugerencia(sug)}
            className="rounded-full border border-forest/20 bg-white/60 px-4 py-2 font-sans text-xs text-ink-muted shadow-sm transition-all hover:border-forest/50 hover:bg-forest-pale hover:text-forest"
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────────────────── */

/**
 * ChatPage — punto de entrada de la interfaz de chat con el asistente IA.
 *
 * Persistencia:
 * - `leerHistorial()` como lazy initializer del useState — carga sincrónica
 *   desde localStorage en el primer render del cliente.
 * - `useEffect([mensajes])` persiste el historial en cada cambio.
 * - `limpiarConversacion()` borra tanto el estado como el localStorage.
 *
 * Flujo de envío:
 * 1. Se agrega el mensaje del usuario a `mensajes`.
 * 2. Se limpia el textarea.
 * 3. Se llama a la mutación (POST /ai/chat).
 * 4. Al resolver: se agrega la respuesta del asistente a `mensajes`.
 * 5. En error: se agrega un mensaje de error amable a `mensajes`.
 */
export default function ChatPage() {
  // Lazy initializer: leerHistorial() se ejecuta solo en el primer render (cliente)
  const [mensajes, setMensajes] = useState<ChatMessage[]>(leerHistorial);
  const [borrador, setBorrador] = useState("");
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useChatMutation();

  /* ── Persistir historial en localStorage en cada cambio ── */
  useEffect(() => {
    guardarHistorial(mensajes);
  }, [mensajes]);

  /* ── Auto-scroll al último mensaje ── */
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, mutation.isPending]);

  /* ── Auto-resize del textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [borrador]);

  /* ── Limpiar conversación ── */
  const limpiarConversacion = useCallback(() => {
    setMensajes([]);
    // guardarHistorial([]) se llamará via el useEffect de arriba
  }, []);

  /* ── Enviar mensaje ── */
  const enviar = useCallback(() => {
    const texto = borrador.trim();
    if (!texto || mutation.isPending) return;

    const msgUsuario: ChatMessage = {
      role: "user",
      contenido: texto,
      timestamp: new Date(),
    };

    setMensajes((prev) => [...prev, msgUsuario]);
    setBorrador("");

    mutation.mutate(texto, {
      onSuccess: (respuesta) => {
        setMensajes((prev) => [
          ...prev,
          { role: "assistant", contenido: respuesta, timestamp: new Date() },
        ]);
      },
      onError: () => {
        setMensajes((prev) => [
          ...prev,
          {
            role: "assistant",
            contenido:
              "Lo siento, no pude conectarme en este momento. Por favor, intentá de nuevo en unos segundos.",
            timestamp: new Date(),
          },
        ]);
      },
    });
  }, [borrador, mutation]);

  /* ── Enter para enviar (Shift+Enter = nueva línea) ── */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const hayMensajes = mensajes.length > 0;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col lg:h-[calc(100vh-3rem)]">
      {/* ── Encabezado ── */}
      <header className="flex shrink-0 items-end justify-between pb-4">
        <div>
          <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
            Asistente de salud
          </p>
          <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
            Tu aliado IA
          </h1>
          <p className="mt-1 font-sans text-sm text-ink-muted">
            Preguntame sobre tu progreso, nutrición o ejercicio.
          </p>
        </div>

        {/* Botón "Nueva conversación" — solo visible cuando hay mensajes */}
        {hayMensajes && (
          <button
            onClick={limpiarConversacion}
            className="flex items-center gap-1.5 rounded-full border border-cream-dark bg-white/60 px-3 py-1.5 font-sans text-xs text-ink-muted shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            title="Borrar el historial de esta conversación"
          >
            <span className="h-3.5 w-3.5">
              <IconTrash />
            </span>
            Nueva conversación
          </button>
        )}
      </header>

      {/* ── Área principal del chat ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-cream-dark bg-white/50">
        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {!hayMensajes ? (
            <EstadoVacio
              onSugerencia={(texto) => {
                setBorrador(texto);
                textareaRef.current?.focus();
              }}
            />
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {mensajes.map((msg, i) => (
                <BurbujaMensaje key={i} mensaje={msg} />
              ))}
              {mutation.isPending && <IndicadorEscritura />}
              <div ref={finRef} />
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="h-px bg-cream-dark shrink-0" />

        {/* ── Input de composición ── */}
        <div className="shrink-0 p-4 lg:p-5">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-3 rounded-2xl border border-cream-dark bg-white/80 px-4 py-3 shadow-sm transition-all focus-within:border-forest/30 focus-within:shadow-[0_0_0_3px_#1E563112]">
              <textarea
                ref={textareaRef}
                rows={1}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={mutation.isPending}
                placeholder="Preguntame algo sobre tu salud…"
                className="flex-1 resize-none bg-transparent font-sans text-sm leading-relaxed text-ink outline-none placeholder:text-ink-muted/40 disabled:opacity-60"
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={enviar}
                disabled={!borrador.trim() || mutation.isPending}
                aria-label="Enviar mensaje"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-cream shadow-sm transition-all hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="h-4 w-4">
                  <IconEnviar />
                </span>
              </button>
            </div>
            <p className="mt-2 text-center font-sans text-[10px] text-ink-muted/50">
              Enter para enviar · Shift + Enter para nueva línea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

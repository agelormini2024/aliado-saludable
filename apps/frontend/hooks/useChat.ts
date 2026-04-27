/**
 * useChat — hooks de Tanstack Query para el chat IA.
 *
 * El chat no tiene historial persistente en el backend: cada request es
 * independiente (el contexto lo aporta el RAG, no el historial de mensajes).
 * El historial visible en pantalla es estado local del componente.
 */
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Estructura de un mensaje en el hilo de conversación local */
export interface ChatMessage {
  /** Quién envió el mensaje */
  role: "user" | "assistant";
  /** Texto del mensaje */
  contenido: string;
  /** Momento en que se creó (para ordenar y mostrar timestamps si se desea) */
  timestamp: Date;
}

/**
 * useChatMutation — mutación para enviar una pregunta al asistente IA.
 *
 * POST /ai/chat con body { pregunta: string } → { data: { respuesta: string } }
 *
 * Uso:
 * ```tsx
 * const mutation = useChatMutation();
 * mutation.mutate("¿Cuánto bajé este mes?", {
 *   onSuccess: (respuesta) => agregarMensaje({ role: "assistant", contenido: respuesta }),
 * });
 * ```
 *
 * @returns Objeto de mutación de Tanstack Query. `data` es el string de respuesta.
 */
export function useChatMutation() {
  return useMutation({
    mutationFn: async (pregunta: string): Promise<string> => {
      const res = await api.post<{ data: { respuesta: string } }>("/ai/chat", {
        pregunta,
      });
      return res.data.data.respuesta;
    },
  });
}

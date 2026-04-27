import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "./rag.service";
import { Usuario } from "@prisma/client";

/**
 * ChatService — orquesta el flujo completo del chat IA con RAG.
 *
 * Para cada pregunta del usuario, el flujo es:
 * 1. Obtener datos de perfil del usuario (nombre, meta de peso)
 * 2. Obtener el peso más reciente registrado
 * 3. Buscar fragmentos relevantes en EmbeddingDocument via búsqueda vectorial (RAG)
 * 4. Construir el prompt con sistema + contexto personal + pregunta
 * 5. Llamar a GPT-4o-mini y devolver la respuesta
 *
 * No hay streaming en el MVP — la respuesta es síncrona y se devuelve completa.
 * La ventana de contexto del modelo es suficiente para el volumen de datos del MVP.
 */
@Injectable()
export class ChatService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(ChatService.name);
  private readonly chatModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>("OPENAI_API_KEY"),
    });
    this.chatModel =
      this.config.get<string>("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini";
  }

  // ─── Prompt del sistema ───────────────────────────────────────────────────────

  /**
   * Prompt del sistema que define el rol y las restricciones del asistente.
   * Se inyecta al inicio de cada conversación (sin historial — MVP sin memoria de chat).
   */
  private readonly SYSTEM_PROMPT = `Sos el asistente de salud de Aliado Saludable, una plataforma para personas que quieren bajar de peso.
Tu rol es acompañar al usuario en su proceso: ayudarlo a entender su progreso, resolver dudas sobre nutrición y ejercicio, y mantenerlo motivado.

Reglas:
- Respondé siempre en español argentino (vos, te, etc.), con un tono cálido y empático — como un amigo que sabe de salud.
- Basá tus respuestas EXCLUSIVAMENTE en el contexto provisto. No inventes datos del usuario que no estén en el contexto.
- Si no tenés información suficiente para responder con precisión, decílo honestamente y ofrecé orientación general.
- Sé conciso pero completo. Evitá respuestas genéricas o excesivamente largas.
- No hagas diagnósticos médicos ni prescribas medicamentos. Derivá a profesionales cuando sea necesario.`;

  // ─── Construcción del contexto ────────────────────────────────────────────────

  /**
   * Arma el bloque de contexto personal del usuario para incluir en el prompt.
   * Incluye perfil básico, peso actual y los fragmentos recuperados por RAG.
   *
   * @param usuario - Registro del usuario autenticado
   * @param pesoActual - Peso más reciente registrado (null si no tiene ninguno)
   * @param fragmentos - Resultados de la búsqueda vectorial (texto natural)
   */
  private construirContexto(
    usuario: Usuario,
    pesoActual: { peso: number; fecha: Date } | null,
    fragmentos: { contenido: string; tipo: string }[],
  ): string {
    const lineas: string[] = ["=== Datos del usuario ==="];

    lineas.push(`Nombre: ${usuario.nombre} ${usuario.apellido}`);

    if (usuario.meta != null) {
      lineas.push(`Meta de peso: ${usuario.meta} kg`);
    }

    if (pesoActual) {
      const fechaStr = new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(pesoActual.fecha);
      lineas.push(`Peso actual: ${pesoActual.peso} kg (registrado el ${fechaStr})`);

      if (usuario.meta != null) {
        const diferencia = (pesoActual.peso - usuario.meta).toFixed(1);
        const signo = parseFloat(diferencia) >= 0 ? "le faltan" : "ya superó su meta por";
        lineas.push(`Diferencia con meta: ${signo} ${Math.abs(parseFloat(diferencia))} kg`);
      }
    }

    if (fragmentos.length > 0) {
      lineas.push("\n=== Historial y contenido relevante ===");
      fragmentos.forEach((f) => lineas.push(`- ${f.contenido}`));
    }

    return lineas.join("\n");
  }

  // ─── Método principal ─────────────────────────────────────────────────────────

  /**
   * Procesa una pregunta del usuario y devuelve la respuesta del asistente IA.
   *
   * @param usuario - Usuario autenticado que hace la pregunta
   * @param pregunta - Texto de la pregunta
   * @returns Respuesta de texto generada por GPT-4o-mini
   */
  async responder(usuario: Usuario, pregunta: string): Promise<string> {
    // 1. Obtener peso más reciente en paralelo con la búsqueda RAG
    const [pesoReciente, fragmentosRag] = await Promise.all([
      this.prisma.registroPeso.findFirst({
        where: { usuarioId: usuario.id },
        orderBy: { fecha: "desc" },
        select: { peso: true, fecha: true },
      }),
      this.ragService.buscarSimilares(pregunta, usuario.id, 10),
    ]);

    // 2. Construir el contexto con los datos recuperados
    const contexto = this.construirContexto(usuario, pesoReciente, fragmentosRag);

    // 3. Armar los mensajes para la API de OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: this.SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `${contexto}\n\n=== Pregunta del usuario ===\n${pregunta}`,
      },
    ];

    // 4. Llamar a GPT-4o-mini (sin streaming — respuesta completa)
    const completion = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const respuesta = completion.choices[0]?.message?.content;

    if (!respuesta) {
      this.logger.warn(`GPT-4o-mini devolvió una respuesta vacía para usuario ${usuario.id}`);
      return "Lo siento, no pude generar una respuesta. Por favor, intentá de nuevo.";
    }

    return respuesta;
  }
}

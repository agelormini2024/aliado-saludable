import Link from "next/link";

/* ─── DATOS ESTÁTICOS ─────────────────────────────────────────────────────── */

/**
 * Beneficios que se muestran en la sección de features.
 * Cada tarjeta tiene un emoji, título, descripción y colores de acento.
 */
const BENEFITS = [
  {
    emoji: "📈",
    title: "Tu progreso, de verdad",
    desc: "Registrá peso y medidas semana a semana. Visualizá tendencias reales, no aspiracionales.",
    border: "border-forest",
    bg: "bg-forest-pale",
  },
  {
    emoji: "🥗",
    title: "Comé sin culpa",
    desc: "Anotá tus comidas con descripción libre. Sin apps de conteo obsesivo ni tablas nutricionales.",
    border: "border-amber",
    bg: "bg-amber-pale",
  },
  {
    emoji: "💬",
    title: "Tu Aliado IA",
    desc: "Una IA que lee TU historial. No respuestas genéricas — contexto real sobre tu proceso.",
    border: "border-forest-light",
    bg: "bg-forest-pale",
  },
  {
    emoji: "🏃",
    title: "Movimiento que cuenta",
    desc: "Caminata, gym, yoga, natación — como sea. Todo lo que hacés suma y todo se registra.",
    border: "border-amber-light",
    bg: "bg-amber-pale",
  },
];

/**
 * Pasos del proceso "Cómo funciona".
 * Diseñados para ser simples y no intimidantes.
 */
const STEPS = [
  {
    num: "01",
    title: "Registrate en minutos",
    desc: "Solo nombre, email y tu meta de peso. Sin tarjeta de crédito. Listo para empezar.",
  },
  {
    num: "02",
    title: "Registrá tu día",
    desc: "Peso, comidas, actividad física. Tan simple y rápido como mandar un mensaje.",
  },
  {
    num: "03",
    title: "Consultá a tu Aliado",
    desc: "Preguntale cualquier cosa. Tu IA conoce tu historial real y te responde en contexto.",
  },
];

/** Alturas (%) para las barras del gráfico decorativo en el hero */
const CHART_BARS = [65, 50, 75, 40, 80, 60, 55];
const CHART_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/* ─── PÁGINA ──────────────────────────────────────────────────────────────── */

/**
 * Home — landing page pública de Aliado Saludable.
 *
 * Presenta la plataforma a usuarios no autenticados con:
 * - Hero con headline tipográfico y tarjetas decorativas de UI
 * - Sección de beneficios en grid 2×2
 * - Sección "Cómo funciona" con 3 pasos
 * - Banda CTA de conversión
 * - Footer simple
 *
 * Es un Server Component puro — sin estado, sin efectos, sin JS en el cliente.
 * Todas las animaciones son CSS-only (scroll-driven animations + keyframes).
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      {/* ════════════════════════════════════════════════════════
          NAVBAR — fijo, con blur de fondo al hacer scroll
          ════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 bg-cream/80 backdrop-blur-md border-b border-cream-dark/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          {/* Logotipo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-white font-heading font-bold text-sm select-none">
              A
            </span>
            <span className="font-heading font-semibold text-ink text-lg leading-none">
              Aliado Saludable
            </span>
          </Link>

          {/* Links de navegación — ocultos en mobile */}
          <nav
            className="hidden md:flex items-center gap-8 text-sm text-ink-muted"
            aria-label="Navegación principal"
          >
            <a
              href="#beneficios"
              className="hover:text-ink transition-colors duration-200"
            >
              Beneficios
            </a>
            <a
              href="#como-funciona"
              className="hover:text-ink transition-colors duration-200"
            >
              Cómo funciona
            </a>
          </nav>

          {/* CTAs del header */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-block text-sm text-ink-muted hover:text-ink transition-colors px-4 py-2"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="text-sm bg-forest text-white px-5 py-2.5 rounded-full hover:bg-forest-mid transition-colors duration-200 font-medium"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          HERO — ocupa el 100vh con headline tipográfico gigante
          y tarjetas decorativas flotantes a la derecha
          ════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden pt-16">
        {/* Blobs de fondo — gradientes difusos que dan profundidad y calidez */}
        <div
          aria-hidden
          className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full bg-forest-pale blur-3xl opacity-80 pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute bottom-[-12%] left-[-8%] w-[500px] h-[500px] rounded-full bg-amber-pale blur-3xl opacity-60 pointer-events-none"
        />

        <div className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-20">

            {/* ── Columna izquierda: tipografía y CTAs ── */}
            <div className="relative z-10 max-w-xl">
              {/* Overline — categoría del producto en color ámbar */}
              <span
                className="inline-block text-amber text-xs tracking-[0.25em] uppercase font-medium mb-8 animate-fade-up"
                style={{ animationDelay: "0ms" }}
              >
                Tu plataforma de salud personal
              </span>

              {/* Headline principal — tipografía serif itálica, escala grande */}
              <h1
                className="font-heading italic text-6xl sm:text-7xl xl:text-[5.5rem] leading-[0.88] text-ink mb-8 animate-fade-up"
                style={{ animationDelay: "100ms" }}
              >
                Tu proceso.
                <br />
                Tu ritmo.
                <br />
                <span className="text-forest">Tu Aliado.</span>
              </h1>

              {/* Subtítulo — tono conversacional, no médico */}
              <p
                className="text-ink-muted text-lg leading-relaxed max-w-md mb-10 animate-fade-up"
                style={{ animationDelay: "220ms" }}
              >
                Registrá tu progreso, comidas y actividad. Consultá a tu IA
                con tu historial real. Sin juicios. Sin reglas rígidas.
              </p>

              {/* Botones de acción */}
              <div
                className="flex flex-col sm:flex-row gap-4 animate-fade-up"
                style={{ animationDelay: "350ms" }}
              >
                <Link
                  href="/registro"
                  className="inline-flex items-center justify-center gap-2 bg-forest text-white px-8 py-4 rounded-full text-base font-medium hover:bg-forest-mid hover:gap-3 hover:shadow-lg transition-all duration-200"
                >
                  Empezar gratis
                  <span aria-hidden>→</span>
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 text-ink border border-cream-dark px-8 py-4 rounded-full text-base font-medium hover:bg-cream-dark transition-colors duration-200"
                >
                  Ver cómo funciona
                </a>
              </div>
            </div>

            {/* ── Columna derecha: tarjetas decorativas flotantes ──
                Muestran un mockup de la UI real del producto para que el
                usuario entienda de un vistazo qué va a encontrar adentro. */}
            <div
              className="relative h-[480px] hidden lg:block"
              aria-hidden
            >
              {/* Tarjeta principal — gráfico de progreso semanal */}
              <div className="absolute top-8 right-6 w-72 bg-white rounded-3xl shadow-2xl p-6 animate-float z-10">
                <div className="flex justify-between items-center mb-5">
                  <p className="text-sm font-medium text-ink-muted">
                    Esta semana
                  </p>
                  <span className="text-xl">📊</span>
                </div>

                {/* Gráfico de barras — datos de ejemplo decorativos */}
                <div className="flex items-end gap-1.5 h-20 mb-3">
                  {CHART_BARS.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-forest-pale rounded-t"
                      style={{ height: `${height}%` }}
                    >
                      <div className="w-full h-full bg-forest-light rounded-t opacity-80" />
                    </div>
                  ))}
                </div>

                {/* Etiquetas de días */}
                <div className="flex mb-5">
                  {CHART_DAYS.map((day, i) => (
                    <span
                      key={i}
                      className="flex-1 text-center text-[10px] text-ink-muted"
                    >
                      {day}
                    </span>
                  ))}
                </div>

                {/* Stat de peso */}
                <div className="flex items-center justify-between border-t border-cream-dark pt-4">
                  <div>
                    <p className="text-xs text-ink-muted mb-1">Peso actual</p>
                    <p className="font-heading font-bold text-2xl text-ink">
                      84.2{" "}
                      <span className="text-base font-normal text-ink-muted">
                        kg
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-muted mb-1">Progreso</p>
                    <p className="text-forest font-semibold text-sm">
                      ↓ −1.8 kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Tarjeta IA — mensaje del Aliado con contexto personal */}
              <div className="absolute bottom-20 left-0 w-56 bg-forest text-white rounded-3xl rounded-tl-lg shadow-xl p-5 animate-float-slow z-20">
                <p className="text-[10px] text-forest-light font-semibold mb-2 tracking-wider uppercase">
                  Tu Aliado IA
                </p>
                <p className="text-sm leading-relaxed">
                  ¡Muy bien! Esta semana bajaste 0.8 kg. Seguí con las
                  caminatas 🚶‍♀️
                </p>
              </div>

              {/* Tarjeta de actividad diaria — acento ámbar */}
              <div
                className="absolute top-28 left-4 w-44 bg-amber-pale rounded-2xl shadow-lg p-4 animate-float-tiny z-20"
              >
                <p className="text-[10px] text-amber font-semibold mb-2 tracking-wider uppercase">
                  Hoy
                </p>
                <p className="text-sm text-ink">🏃 Caminata 45 min</p>
                <p className="text-sm text-ink mt-1.5">🥗 Almuerzo ✓</p>
              </div>
            </div>
          </div>
        </div>

        {/* Indicador de scroll */}
        <div
          className="pb-8 flex justify-center animate-fade-up"
          style={{ animationDelay: "600ms" }}
        >
          <div className="flex flex-col items-center gap-2 text-ink-muted/60 text-xs tracking-widest">
            <span>Descubrí más</span>
            <span className="animate-bounce-gentle">↓</span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          BENEFITS — 4 features en grid 2×2
          Aparecen con scroll-driven animation al entrar en viewport
          ════════════════════════════════════════════════════════ */}
      <section id="beneficios" className="bg-white py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Encabezado de sección */}
          <div className="text-center mb-16 scroll-reveal">
            <span className="inline-block text-amber text-xs tracking-[0.25em] uppercase font-medium mb-4">
              Por qué Aliado Saludable
            </span>
            <h2 className="font-heading italic text-4xl lg:text-5xl text-ink leading-tight">
              Todo lo que necesitás,
              <br />
              <span className="text-forest">sin lo que no.</span>
            </h2>
          </div>

          {/* Grid de tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            {BENEFITS.map((benefit, i) => (
              <div
                key={i}
                className={`${benefit.bg} rounded-3xl p-8 border-l-4 ${benefit.border} scroll-reveal hover:shadow-md transition-shadow duration-300`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="text-4xl mb-5 block">{benefit.emoji}</span>
                <h3 className="font-heading font-semibold text-xl text-ink mb-3">
                  {benefit.title}
                </h3>
                <p className="text-ink-muted leading-relaxed text-base">
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          HOW IT WORKS — 3 pasos numerados con estilo editorial
          Fondo verde pálido para separar visualmente de la sección anterior
          ════════════════════════════════════════════════════════ */}
      <section id="como-funciona" className="bg-forest-pale py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Encabezado */}
          <div className="text-center mb-16 scroll-reveal">
            <span className="inline-block text-forest-mid text-xs tracking-[0.25em] uppercase font-medium mb-4">
              Cómo funciona
            </span>
            <h2 className="font-heading italic text-4xl lg:text-5xl text-ink leading-tight">
              Tres pasos para
              <br />
              <span className="text-forest">encontrar tu ritmo.</span>
            </h2>
          </div>

          {/* Pasos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16 relative">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="relative scroll-reveal"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Número grande — decorativo, semitransparente */}
                <p className="font-heading font-bold text-8xl text-forest opacity-15 mb-3 leading-none select-none">
                  {step.num}
                </p>

                {/* Línea conectora entre pasos — solo desktop */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    className="hidden md:block absolute top-10 left-[calc(100%_-_1rem)] w-16 h-px bg-forest opacity-20"
                  />
                )}

                <h3 className="font-heading font-semibold text-xl text-ink mb-3">
                  {step.title}
                </h3>
                <p className="text-ink-muted leading-relaxed text-base">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CTA BAND — sección de conversión final
          Fondo verde oscuro, texto blanco, botón en ámbar para contraste
          ════════════════════════════════════════════════════════ */}
      <section className="bg-forest py-24 lg:py-32 scroll-reveal">
        <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading italic text-4xl lg:text-6xl text-white mb-6 leading-[1.05]">
            ¿Listo para empezar
            <br />
            <span className="text-forest-light">a tu ritmo?</span>
          </h2>
          <p className="text-white/65 text-lg mb-10 max-w-sm mx-auto leading-relaxed">
            Registrate gratis y empezá a construir tu proceso. Sin
            compromisos, sin tarjeta de crédito.
          </p>
          <Link
            href="/registro"
            className="inline-flex items-center gap-2 bg-amber text-white px-10 py-4 rounded-full text-base font-semibold hover:bg-amber-light hover:gap-3 hover:shadow-2xl shadow-lg transition-all duration-200"
          >
            Registrarte gratis
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FOOTER — simple, cálido, consistente con la paleta
          ════════════════════════════════════════════════════════ */}
      <footer className="bg-cream-dark py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-forest flex items-center justify-center text-white font-heading font-bold text-xs select-none">
              A
            </span>
            <span className="font-heading font-semibold text-ink">
              Aliado Saludable
            </span>
          </div>

          {/* Copyright */}
          <p className="text-ink-muted text-sm text-center">
            © 2025 Aliado Saludable. Hecho con cuidado.
          </p>

          {/* Links secundarios */}
          <nav
            className="flex items-center gap-6 text-sm text-ink-muted"
            aria-label="Links del footer"
          >
            <a href="#" className="hover:text-ink transition-colors">
              Privacidad
            </a>
            <a href="#" className="hover:text-ink transition-colors">
              Términos
            </a>
            <Link href="/login" className="hover:text-ink transition-colors">
              Ingresar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

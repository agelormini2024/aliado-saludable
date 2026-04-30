/**
 * Seed de datos de demo — Aliado Saludable
 *
 * Crea 3 usuarios con datos realistas para la demo en Workana:
 * registros de peso (30 días), medidas (3 tomas), actividad (15 sesiones)
 * y comidas (8 días completos).
 *
 * Cómo correr:
 *   DATABASE_URL="postgresql://..." npx prisma db seed
 *
 * Los usuarios creados tienen contraseña: Demo1234!
 * No toca usuarios con rol ADMIN ni COACH.
 */

import { PrismaClient, RolUsuario } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Genera una fecha N días atrás, con hora aleatoria de mañana */
function diasAtras(n: number, horaFija?: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(horaFija ?? 7 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

/** Redondea a 1 decimal */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

const EMAILS_SEED = ["maria.gonzalez@demo.com", "carlos.rodriguez@demo.com", "laura.martinez@demo.com"];

async function main() {
  console.log("🌱 Iniciando seed...\n");

  const passwordHash = await bcrypt.hash("Demo1234!", 10);

  // Limpiar datos anteriores del seed (sin tocar admins ni coaches)
  const usuariosExistentes = await prisma.usuario.findMany({
    where: { email: { in: EMAILS_SEED } },
    select: { id: true },
  });
  const ids = usuariosExistentes.map((u) => u.id);

  if (ids.length > 0) {
    // EmbeddingDocument no tiene FK con cascade — borrar manualmente
    await prisma.embeddingDocument.deleteMany({ where: { usuarioId: { in: ids } } });
    // Las demás entidades tienen onDelete: Cascade — se eliminan al borrar el usuario
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    console.log(`🗑  Usuarios anteriores del seed eliminados\n`);
  }

  // ─── USUARIOS ───────────────────────────────────────────────────────────────

  const perfiles = [
    {
      email: "maria.gonzalez@demo.com",
      nombre: "María",
      apellido: "González",
      altura: 162,
      meta: 68,
      pesoBase: 84,
      tendenciaSemanal: -0.35, // baja ~350g por semana
      medidaBase: { cintura: 92, cadera: 104, brazo: 33, muslo: 60 },
    },
    {
      email: "carlos.rodriguez@demo.com",
      nombre: "Carlos",
      apellido: "Rodríguez",
      altura: 178,
      meta: 82,
      pesoBase: 97,
      tendenciaSemanal: -0.45,
      medidaBase: { cintura: 100, cadera: 108, brazo: 38, muslo: 65 },
    },
    {
      email: "laura.martinez@demo.com",
      nombre: "Laura",
      apellido: "Martínez",
      altura: 159,
      meta: 63,
      pesoBase: 71,
      tendenciaSemanal: -0.25,
      medidaBase: { cintura: 82, cadera: 96, brazo: 29, muslo: 56 },
    },
  ];

  for (const perfil of perfiles) {
    const usuario = await prisma.usuario.create({
      data: {
        email: perfil.email,
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        passwordHash,
        rol: RolUsuario.USUARIO,
        altura: perfil.altura,
        meta: perfil.meta,
      },
    });

    // ─── REGISTROS DE PESO ─────────────────────────────────────────────────
    // 11 registros en 30 días (cada 3 días aprox) con tendencia bajando + ruido

    const diasPeso = [30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 0];
    for (const dia of diasPeso) {
      const semanasAtras = dia / 7;
      const tendencia = perfil.tendenciaSemanal * semanasAtras;
      const ruido = (Math.random() - 0.4) * 0.6; // leve asimetría hacia abajo
      await prisma.registroPeso.create({
        data: {
          usuarioId: usuario.id,
          peso: r1(perfil.pesoBase + tendencia + ruido),
          fecha: diasAtras(dia, 7), // siempre a las 7am
          nota: dia === 0 ? "Pesaje de hoy en ayunas" : null,
        },
      });
    }

    // ─── REGISTROS DE MEDIDAS ──────────────────────────────────────────────
    // 3 tomas: al inicio, a la mitad y reciente

    const tomasMedidas = [
      { dias: 28, factor: 0 },
      { dias: 14, factor: 0.5 },
      { dias: 2, factor: 1 },
    ];
    for (const toma of tomasMedidas) {
      const reduccion = toma.factor * 3; // hasta 3cm de reducción en el periodo
      await prisma.registroMedidas.create({
        data: {
          usuarioId: usuario.id,
          cintura: r1(perfil.medidaBase.cintura - reduccion + (Math.random() - 0.5)),
          cadera: r1(perfil.medidaBase.cadera - reduccion * 0.6 + (Math.random() - 0.5)),
          brazo: r1(perfil.medidaBase.brazo - reduccion * 0.2 + (Math.random() - 0.5) * 0.5),
          muslo: r1(perfil.medidaBase.muslo - reduccion * 0.4 + (Math.random() - 0.5)),
          fecha: diasAtras(toma.dias),
        },
      });
    }

    // ─── REGISTROS DE ACTIVIDAD ────────────────────────────────────────────
    // 15 sesiones en 30 días — variedad de tipos

    const sesiones = [
      { dias: 29, tipo: "CAMINATA", duracion: 45, calorias: 210 },
      { dias: 27, tipo: "GYM", duracion: 60, calorias: 340 },
      { dias: 25, tipo: "CAMINATA", duracion: 30, calorias: 140 },
      { dias: 23, tipo: "CICLISMO", duracion: 40, calorias: 280 },
      { dias: 21, tipo: "GYM", duracion: 60, calorias: 350 },
      { dias: 19, tipo: "CAMINATA", duracion: 60, calorias: 270 },
      { dias: 17, tipo: "NATACION", duracion: 45, calorias: 390 },
      { dias: 15, tipo: "GYM", duracion: 60, calorias: 345 },
      { dias: 13, tipo: "CAMINATA", duracion: 40, calorias: 185 },
      { dias: 11, tipo: "CICLISMO", duracion: 30, calorias: 195 },
      { dias: 9, tipo: "GYM", duracion: 60, calorias: 355 },
      { dias: 7, tipo: "CAMINATA", duracion: 50, calorias: 230 },
      { dias: 5, tipo: "NATACION", duracion: 45, calorias: 395 },
      { dias: 3, tipo: "GYM", duracion: 60, calorias: 348 },
      { dias: 1, tipo: "CAMINATA", duracion: 35, calorias: 160 },
    ];
    for (const s of sesiones) {
      await prisma.registroActividad.create({
        data: {
          usuarioId: usuario.id,
          tipo: s.tipo,
          duracion: s.duracion,
          calorias: s.calorias + Math.floor((Math.random() - 0.5) * 20),
          fecha: diasAtras(s.dias, 18), // actividad a las 18hs
        },
      });
    }

    // ─── REGISTROS DE COMIDAS ──────────────────────────────────────────────
    // 8 días completos con 3-4 momentos por día

    const menuDesayuno = [
      { desc: "Avena con frutas del bosque y miel", cal: 310 },
      { desc: "Tostadas integrales con palta y huevo pochado", cal: 340 },
      { desc: "Yogur natural con granola y banana", cal: 265 },
      { desc: "Licuado de leche descremada con frutillas y avena", cal: 280 },
    ];
    const menuAlmuerzo = [
      { desc: "Pollo a la plancha con ensalada mixta y arroz integral", cal: 520 },
      { desc: "Milanesa de soja con puré de calabaza", cal: 480 },
      { desc: "Fideos integrales con salsa de tomate y albahaca fresca", cal: 450 },
      { desc: "Ensalada de lentejas con vegetales asados y aceite de oliva", cal: 410 },
      { desc: "Pescado al horno con papas y ensalada verde", cal: 490 },
    ];
    const menuMerienda = [
      { desc: "Manzana verde y puñado de almendras", cal: 175 },
      { desc: "Mate con dos tostadas integrales", cal: 110 },
      { desc: "Banana y yogur descremado", cal: 195 },
      { desc: "Infusión con medialunas integrales", cal: 220 },
    ];
    const menuCena = [
      { desc: "Sopa de verduras con fideos y pan integral", cal: 370 },
      { desc: "Omelette de claras con espinaca y queso descremado", cal: 295 },
      { desc: "Pescado grillado con vegetales al vapor", cal: 410 },
      { desc: "Ensalada César con pollo grillado", cal: 380 },
    ];

    const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    for (let dia = 7; dia >= 0; dia--) {
      // Desayuno — siempre
      const des = pick(menuDesayuno);
      await prisma.registroComida.create({
        data: { usuarioId: usuario.id, momento: "DESAYUNO", descripcion: des.desc, calorias: des.cal, fecha: diasAtras(dia, 8) },
      });

      // Almuerzo — siempre
      const alm = pick(menuAlmuerzo);
      await prisma.registroComida.create({
        data: { usuarioId: usuario.id, momento: "ALMUERZO", descripcion: alm.desc, calorias: alm.cal, fecha: diasAtras(dia, 13) },
      });

      // Merienda — 80% de los días
      if (Math.random() > 0.2) {
        const mer = pick(menuMerienda);
        await prisma.registroComida.create({
          data: { usuarioId: usuario.id, momento: "MERIENDA", descripcion: mer.desc, calorias: mer.cal, fecha: diasAtras(dia, 17) },
        });
      }

      // Cena — siempre
      const cen = pick(menuCena);
      await prisma.registroComida.create({
        data: { usuarioId: usuario.id, momento: "CENA", descripcion: cen.desc, calorias: cen.cal, fecha: diasAtras(dia, 21) },
      });
    }

    console.log(`✅ ${perfil.nombre} ${perfil.apellido} (${perfil.email}) — datos cargados`);
  }

  console.log("\n🎉 Seed completado. Contraseña de todos los usuarios: Demo1234!");
  console.log("📋 Usuarios creados:");
  EMAILS_SEED.forEach((e) => console.log(`   • ${e}`));
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

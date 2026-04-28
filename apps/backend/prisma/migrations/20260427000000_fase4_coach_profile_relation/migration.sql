-- Fase 4: Coach Profile Relation
--
-- Agrega el campo coachProfileId en Usuario para vincular un usuario con rol=COACH
-- a su perfil de Coach. Esto permite que el coach encuentre sus pacientes navegando:
--   usuarioCoach -> coachProfile -> pacientes
--
-- Las relaciones existentes (coachId -> Coach) se renombran internamente en Prisma
-- usando @relation("PacienteDeCoach") pero no requieren cambio en la BD.

ALTER TABLE "Usuario"
  ADD COLUMN "coachProfileId" TEXT UNIQUE;

ALTER TABLE "Usuario"
  ADD CONSTRAINT "Usuario_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId")
  REFERENCES "Coach"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

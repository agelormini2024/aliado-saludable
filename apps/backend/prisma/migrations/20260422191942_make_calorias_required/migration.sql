/*
  Warnings:

  - Made the column `calorias` on table `RegistroActividad` required. This step will fail if there are existing NULL values in that column.
  - Made the column `calorias` on table `RegistroComida` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "RegistroActividad" ALTER COLUMN "calorias" SET NOT NULL;

-- AlterTable
ALTER TABLE "RegistroComida" ALTER COLUMN "calorias" SET NOT NULL;

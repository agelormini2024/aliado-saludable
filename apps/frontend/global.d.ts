/**
 * Declaraciones globales de tipos para archivos que TypeScript no reconoce nativamente.
 * Los imports de CSS global (no CSS modules) se usan solo por sus efectos secundarios
 * — no exportan nada, pero TS necesita saber que la importación es válida.
 */
declare module "*.css" {}

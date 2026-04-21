export type RolUsuario = "USUARIO" | "COACH" | "ADMIN";

export interface UsuarioPublico {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
}

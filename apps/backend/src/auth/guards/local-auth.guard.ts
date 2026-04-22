import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * LocalAuthGuard — activa la LocalStrategy (email + password) en el endpoint de login
 *
 * Solo se usa en POST /auth/login. Passport extrae email y password del body,
 * llama a LocalStrategy.validate() y, si las credenciales son válidas,
 * adjunta el usuario a request.user antes de que llegue al controller.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {}

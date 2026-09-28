/**
 * Errores de negocio. El mensaje ya viene en español y se muestra tal cual
 * al usuario (formularios y respuestas JSON de la API).
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No se encontró el recurso solicitado.") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("Su sesión expiró. Vuelva a iniciar sesión.", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super("No tiene permiso para realizar esta acción.", 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors: Record<string, string[] | undefined> = {}) {
    super(message, 400, fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** Error del motor de cálculo (no disponible, archivo inválido, etc.). */
export class EngineError extends AppError {
  constructor(message: string, status = 502) {
    super(message, status);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Código PostgreSQL 23505 = violación de restricción de unicidad. */
export function isUniqueViolation(e: unknown): boolean {
  const code =
    (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

import { Prisma } from "@prisma/client";

export function getApiErrorMessage(err: unknown) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return "Database is unavailable. Please check connectivity and DATABASE_URL.";
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Internal server error";
}

export function getApiErrorStatus(err: unknown) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return 503;
  }

  return 500;
}

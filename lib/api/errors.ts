import { Prisma } from "@prisma/client";

export function getApiErrorMessage(err: unknown) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return "Database is unavailable. Please check connectivity and DATABASE_URL.";
  }

  if (
    err instanceof Error &&
    "statusCode" in err &&
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
  ) {
    return err.message;
  }

  return "Internal server error";
}

export function getApiErrorStatus(err: unknown) {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return 503;
  }

  if (
    err instanceof Error &&
    "statusCode" in err &&
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
  ) {
    return err.statusCode;
  }

  return 500;
}

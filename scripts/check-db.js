const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Testing database connection...");
  console.log(
    "DATABASE_URL:",
    process.env.DATABASE_URL.replace(/:[^:]+@/, ":****@"),
  ); // Hide password

  try {
    const userCount = await prisma.user.count();
    console.log("✅ Connection successful!");
    console.log(`Found ${userCount} users.`);
  } catch (e) {
    console.error("❌ Connection failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

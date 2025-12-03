const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.user.create({
    data: {
      name: "Agus",
      code: "1234",
    },
  });

  console.log("🌱 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error in seed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

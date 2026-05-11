import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hashPassword("Admin123!");
  const crewPassword = await hashPassword("Crew123!");

  const aurora = await prisma.ship.upsert({
    where: { imoNumber: "IMO-10001" },
    update: {},
    create: { name: "MV Aurora", imoNumber: "IMO-10001" }
  });

  const pacific = await prisma.ship.upsert({
    where: { imoNumber: "IMO-10002" },
    update: {},
    create: { name: "MV Pacific Star", imoNumber: "IMO-10002" }
  });

  await prisma.user.upsert({
    where: { email: "admin@maritime.test" },
    update: {},
    create: { name: "Fleet Admin", email: "admin@maritime.test", passwordHash: adminPassword, role: "ADMIN" }
  });

  const crew = await prisma.user.upsert({
    where: { email: "crew@maritime.test" },
    update: {},
    create: { name: "Aarav Crew", email: "crew@maritime.test", passwordHash: crewPassword, role: "CREW", shipId: aurora.id }
  });

  await prisma.maintenanceTask.createMany({
    data: [
      {
        title: "Inspect lifeboat davits",
        description: "Check davit movement, lubrication, and emergency lowering controls.",
        shipId: aurora.id,
        assignedToId: crew.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      },
      {
        title: "Main engine oil analysis",
        description: "Collect sample and upload notes after lab result review.",
        shipId: pacific.id,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  await prisma.safetyDrill.createMany({
    data: [
      {
        title: "Monthly fire response drill",
        type: "Fire Drill",
        shipId: aurora.id,
        scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      },
      {
        title: "Abandon ship evacuation drill",
        type: "Evacuation",
        shipId: pacific.id,
        scheduledDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      }
    ]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

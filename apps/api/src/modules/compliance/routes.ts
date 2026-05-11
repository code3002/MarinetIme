import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { getComplianceSummary } from "./service.js";

export const complianceRouter = Router();

complianceRouter.use(requireAuth);

complianceRouter.get("/summary", async (req, res) => {
  const shipId = typeof req.query.shipId === "string" ? req.query.shipId : undefined;
  const effectiveShipId = req.user!.role === "CREW" ? req.user!.shipId ?? undefined : shipId;
  res.json(await getComplianceSummary(effectiveShipId));
});

complianceRouter.get("/dashboard", async (_req, res) => {
  const ships = await prisma.ship.findMany({ orderBy: { name: "asc" } });
  const summaries = await Promise.all(
    ships.map(async (ship) => ({ ship, summary: await getComplianceSummary(ship.id) }))
  );

  res.json({ fleet: await getComplianceSummary(), ships: summaries });
});

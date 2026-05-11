import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const shipsRouter = Router();

shipsRouter.use(requireAuth);

shipsRouter.get("/", async (_req, res) => {
  const ships = await prisma.ship.findMany({ orderBy: { name: "asc" } });
  res.json(ships);
});

shipsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(2),
      imoNumber: z.string().min(3),
      status: z.string().default("ACTIVE")
    }).parse(req.body);

    const ship = await prisma.ship.create({ data: input });
    res.status(201).json(ship);
  } catch (error) {
    next(error);
  }
});

shipsRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(2).optional(),
      imoNumber: z.string().min(3).optional(),
      status: z.string().optional()
    }).parse(req.body);

    const ship = await prisma.ship.update({ where: { id: String(req.params.id) }, data: input });
    res.json(ship);
  } catch (error) {
    next(error);
  }
});

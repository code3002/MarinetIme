import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const drillsRouter = Router();

drillsRouter.use(requireAuth);

drillsRouter.get("/", async (req, res) => {
  const { shipId, status, from, to } = req.query;
  const isCrew = req.user!.role === "CREW";

  const drills = await prisma.safetyDrill.findMany({
    where: {
      shipId: isCrew && req.user!.shipId ? req.user!.shipId : typeof shipId === "string" ? shipId : undefined,
      status: typeof status === "string" ? status as any : undefined,
      scheduledDate: {
        gte: typeof from === "string" ? new Date(from) : undefined,
        lte: typeof to === "string" ? new Date(to) : undefined
      }
    },
    include: { ship: true, attendances: { include: { crew: { select: { id: true, name: true } } } } },
    orderBy: { scheduledDate: "asc" }
  });

  res.json(drills);
});

drillsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(3),
      type: z.string().min(2),
      scheduledDate: z.string().datetime(),
      shipId: z.string()
    }).parse(req.body);

    const drill = await prisma.safetyDrill.create({
      data: { ...input, scheduledDate: new Date(input.scheduledDate) }
    });

    const crew = await prisma.user.findMany({ where: { role: "CREW", shipId: input.shipId } });
    if (crew.length) {
      await prisma.drillAttendance.createMany({
        data: crew.map((member) => ({ drillId: drill.id, crewId: member.id })),
        skipDuplicates: true
      });
    }

    res.status(201).json(drill);
  } catch (error) {
    next(error);
  }
});

drillsRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(3).optional(),
      type: z.string().min(2).optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "MISSED"]).optional(),
      scheduledDate: z.string().datetime().optional()
    }).parse(req.body);

    const drill = await prisma.safetyDrill.update({
      where: { id: String(req.params.id) },
      data: {
        ...input,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
        completedAt: input.status === "COMPLETED" ? new Date() : undefined
      }
    });

    res.json(drill);
  } catch (error) {
    next(error);
  }
});

drillsRouter.post("/:id/attendance", requireRole("CREW"), async (req, res, next) => {
  try {
    const input = z.object({ attended: z.boolean().default(true) }).parse(req.body);
    const attendance = await prisma.drillAttendance.upsert({
      where: { drillId_crewId: { drillId: String(req.params.id), crewId: req.user!.id } },
      update: { attended: input.attended, submittedAt: new Date() },
      create: { drillId: String(req.params.id), crewId: req.user!.id, attended: input.attended, submittedAt: new Date() }
    });

    res.json(attendance);
  } catch (error) {
    next(error);
  }
});

drillsRouter.post("/:id/complete", requireRole("ADMIN"), async (req, res) => {
  const drill = await prisma.safetyDrill.update({
    where: { id: String(req.params.id) },
    data: { status: "COMPLETED", completedAt: new Date() }
  });

  res.json(drill);
});

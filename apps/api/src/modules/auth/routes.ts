import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, signAuthToken, verifyPassword } from "../../lib/auth.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "CREW"]).default("CREW"),
  shipId: z.string().optional()
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        role: input.role,
        shipId: input.shipId
      },
      select: { id: true, name: true, email: true, role: true, shipId: true }
    });

    res.status(201).json({ user, token: signAuthToken({ userId: user.id, role: user.role }) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: signAuthToken({ userId: user.id, role: user.role }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shipId: user.shipId }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, shipId: true, ship: true }
  });

  res.json(user);
});

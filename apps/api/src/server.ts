import "dotenv/config";
import crypto from "node:crypto";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { classifyBloodPressure } from "./bp.js";

const scryptAsync = promisify(crypto.scrypt);
const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "dev-only-replace-this-secret";

type AuthRequest = express.Request & { userId?: string };

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const readingSchema = z.object({
  systolic: z.number().int().min(60).max(260),
  diastolic: z.number().int().min(40).max(180),
  pulse: z.number().int().min(30).max(220).optional(),
  takenAt: z.string().datetime(),
  posture: z.string().optional(),
  arm: z.string().optional(),
  cuffType: z.string().optional(),
  context: z.string().max(500).optional(),
  symptoms: z.array(z.string()).default([])
});

function publicUser(user: { id: string; email: string; name: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signToken(userId: string) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }));
  const signature = crypto.createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
  if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return decoded.sub;
}

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.header("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ message: "Authentication required" });

  const userId = verifyToken(token);
  if (!userId) return res.status(401).json({ message: "Invalid or expired token" });

  req.userId = userId;
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) return res.status(409).json({ message: "An account with this email already exists" });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password)
      }
    });

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

app.get("/readings", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const readings = await prisma.bloodPressureReading.findMany({
      where: { userId: req.userId },
      orderBy: { takenAt: "desc" },
      take: 100
    });
    res.json(readings);
  } catch (error) {
    next(error);
  }
});

app.post("/readings", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = readingSchema.parse(req.body);
    const advice = classifyBloodPressure(input.systolic, input.diastolic, input.symptoms);
    const reading = await prisma.bloodPressureReading.create({
      data: {
        ...input,
        userId: req.userId!,
        takenAt: new Date(input.takenAt),
        category: advice.category,
        riskLevel: advice.riskLevel,
        advice
      }
    });
    res.status(201).json(reading);
  } catch (error) {
    next(error);
  }
});

app.post("/advice/preview", requireAuth, (req, res) => {
  const input = z.object({
    systolic: z.number().int(),
    diastolic: z.number().int(),
    symptoms: z.array(z.string()).default([])
  }).parse(req.body);
  res.json(classifyBloodPressure(input.systolic, input.diastolic, input.symptoms));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request", issues: error.issues });
  console.error(error);
  res.status(500).json({ message: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`hyperCare API listening on http://localhost:${port}`);
});

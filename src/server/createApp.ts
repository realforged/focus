import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();
import { db } from "../db/index.ts";
import { users, habits, habitLogs, routines, routineLogs } from "../db/schema.ts";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "focus_now_fallback_jwt_secret_key_2026";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET environment variable is not set. Using fallback secret key.");
}

// Authentication Middleware
interface AuthRequest extends express.Request {
  user?: {
    uid: string;
    email: string;
  };
}


function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing. Please sign in." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Session expired or invalid token. Please sign in again." });
    }
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  });
}

export function createApp() {
  const app = express();

  // CORS Middleware for Vercel Frontend -> Render Backend communication
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json());

  // Logging Middleware
  app.use((req, res, next) => {
    // Redact sensitive fields before logging
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = "[REDACTED]";

    try {
      const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} - Headers: ${JSON.stringify(safeHeaders)} - Body: ${JSON.stringify(safeBody)}\n`;
      fs.appendFile(path.join(process.cwd(), "server_requests.log"), logLine, "utf-8", () => {});
    } catch (e) {
      // Ignored for cloud container filesystems
    }
    console.log(`[SERVER-REQ] ${req.method} ${req.url}`);
    next();
  });

  // Health Check Endpoint (For Cloud Deployment / Render Health Checks)
  app.get(["/api/health", "/health"], (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // --- REST ENDPOINTS ---

  // 1. Authentication

  // Register
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required fields." });
    }

    try {
      const emailLower = email.toLowerCase().trim();
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, emailLower));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "A user with this email address already exists." });
      }

      const passwordHashVal = await bcrypt.hash(password, 10);
      const customUid = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const todayStr = new Date().toISOString().split('T')[0];

      // On onboarding/registration, we start the 90-day challenge and set day 1
      const [newUser] = await db.insert(users)
        .values({
          uid: customUid,
          email: emailLower,
          passwordHash: passwordHashVal,
          totalPoints: 0,
          lockedInDays: 0,
          consecutiveLockedInStreak: 0,
          journeyStartDate: todayStr,
          challengeDays: 90,
          isChallengeStarted: true,
        })
        .returning();

      // Seed initial 3 habits for this user
      const initialSeedHabits = [
        { id: `fit-gym-${customUid}`, name: "Power Workout", category: "Fitness", points: 30, type: "Count", target: 1, unit: "workout", repeat: "Daily", enableFocusTimer: 0 },
        { id: `read-book-${customUid}`, name: "Technical Reading", category: "Reading", points: 15, type: "Timer", target: 30, unit: "min", repeat: "Daily", enableFocusTimer: 1 },
        { id: `mind-med-${customUid}`, name: "Mindfulness Breathing", category: "Mindset", points: 10, type: "Timer", target: 10, unit: "min", repeat: "Daily", enableFocusTimer: 1 }
      ];

      for (const h of initialSeedHabits) {
        await db.insert(habits).values({
          id: h.id,
          userId: customUid,
          name: h.name,
          category: h.category,
          points: h.points,
          type: h.type,
          target: h.target,
          unit: h.unit,
          repeat: h.repeat,
          enableFocusTimer: h.enableFocusTimer,
          createdAt: todayStr,
        });
      }

      const token = jwt.sign({ uid: customUid, email: emailLower }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({
        token,
        user: {
          id: newUser.uid, // mapped to id for frontend compatibility
          email: newUser.email,
          total_points: newUser.totalPoints,
          locked_in_days: newUser.lockedInDays,
          consecutive_locked_in_streak: newUser.consecutiveLockedInStreak,
          journey_start_date: newUser.journeyStartDate,
          challenge_days: newUser.challengeDays,
          is_challenge_started: newUser.isChallengeStarted,
        }
      });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Failed to register new account. " + err.message });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required fields." });
    }

    try {
      const emailLower = email.toLowerCase().trim();
      const existingUser = await db.select().from(users).where(eq(users.email, emailLower));
      
      if (existingUser.length === 0) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const user = existingUser[0];
      if (!user.passwordHash) {
        return res.status(401).json({ error: "This account uses a different sign-in method." });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        token,
        user: {
          id: user.uid, // mapped to id for frontend compatibility
          email: user.email,
          total_points: user.totalPoints,
          locked_in_days: user.lockedInDays,
          consecutive_locked_in_streak: user.consecutiveLockedInStreak,
          journey_start_date: user.journeyStartDate,
          challenge_days: user.challengeDays,
          is_challenge_started: user.isChallengeStarted,
        }
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "An unexpected error occurred during login." });
    }
  });

  // Get User Profile
  app.get("/api/user/me", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const existingUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (existingUser.length === 0) {
        return res.status(404).json({ error: "User profile not found." });
      }
      const user = existingUser[0];
      res.json({
        id: user.uid, // mapped to id for frontend compatibility
        email: user.email,
        total_points: user.totalPoints,
        locked_in_days: user.lockedInDays,
        consecutive_locked_in_streak: user.consecutiveLockedInStreak,
        journey_start_date: user.journeyStartDate,
        challenge_days: user.challengeDays,
        is_challenge_started: user.isChallengeStarted,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user profile." });
    }
  });

  // Sync user stats
  app.post("/api/user/sync-journey", authenticateToken as any, async (req: AuthRequest, res) => {
    const { journey_start_date, total_points, locked_in_days, consecutive_locked_in_streak } = req.body;
    try {
      const existingUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (existingUser.length === 0) {
        return res.status(404).json({ error: "User session not found." });
      }

      const updateData: any = {};
      if (journey_start_date !== undefined) updateData.journeyStartDate = journey_start_date;
      if (total_points !== undefined) updateData.totalPoints = total_points;
      if (locked_in_days !== undefined) updateData.lockedInDays = locked_in_days;
      if (consecutive_locked_in_streak !== undefined) updateData.consecutiveLockedInStreak = consecutive_locked_in_streak;

      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.uid, req.user!.uid))
        .returning();

      res.json({
        id: updatedUser.uid,
        email: updatedUser.email,
        total_points: updatedUser.totalPoints,
        locked_in_days: updatedUser.lockedInDays,
        consecutive_locked_in_streak: updatedUser.consecutiveLockedInStreak,
        journey_start_date: updatedUser.journeyStartDate,
        challenge_days: updatedUser.challengeDays,
        is_challenge_started: updatedUser.isChallengeStarted,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to sync user statistics. " + err.message });
    }
  });

  // Reset user data (with 90 days fresh start)
  app.post("/api/user/reset", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const todayStr = new Date().toISOString().split('T')[0];

      // Purge logs, habits and routines for user
      await db.delete(habitLogs).where(eq(habitLogs.userId, uid));
      await db.delete(routineLogs).where(eq(routineLogs.userId, uid));
      await db.delete(habits).where(eq(habits.userId, uid));
      await db.delete(routines).where(eq(routines.userId, uid));

      // Reset user challenge stats back to Day 1 with zero values
      await db.update(users)
        .set({
          totalPoints: 0,
          lockedInDays: 0,
          consecutiveLockedInStreak: 0,
          journeyStartDate: todayStr,
          challengeDays: 90,
          isChallengeStarted: true,
        })
        .where(eq(users.uid, uid));

      // Seed baseline habits again so they can start fresh today immediately
      const initialSeedHabits = [
        { id: `fit-gym-${uid}`, name: "Power Workout", category: "Fitness", points: 30, type: "Count", target: 1, unit: "workout", repeat: "Daily", enableFocusTimer: 0 },
        { id: `read-book-${uid}`, name: "Technical Reading", category: "Reading", points: 15, type: "Timer", target: 30, unit: "min", repeat: "Daily", enableFocusTimer: 1 },
        { id: `mind-med-${uid}`, name: "Mindfulness Breathing", category: "Mindset", points: 10, type: "Timer", target: 10, unit: "min", repeat: "Daily", enableFocusTimer: 1 }
      ];

      for (const h of initialSeedHabits) {
        await db.insert(habits).values({
          id: h.id,
          userId: uid,
          name: h.name,
          category: h.category,
          points: h.points,
          type: h.type,
          target: h.target,
          unit: h.unit,
          repeat: h.repeat,
          enableFocusTimer: h.enableFocusTimer,
          createdAt: todayStr,
        });
      }

      res.json({ message: "Successfully reset all data. Your 90-day challenge starts now on Day 1!" });
    } catch (err: any) {
      res.status(500).json({ error: "Reset failed: " + err.message });
    }
  });


  // 2. Habits Endpoints

  // Get habits
  app.get("/api/habits", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const [userHabits, allLogs] = await Promise.all([
        db.select().from(habits).where(eq(habits.userId, uid)),
        db.select().from(habitLogs).where(eq(habitLogs.userId, uid)),
      ]);

      const logsByHabitId: Record<string, Record<string, number>> = {};
      for (const log of allLogs) {
        if (!logsByHabitId[log.habitId]) {
          logsByHabitId[log.habitId] = {};
        }
        logsByHabitId[log.habitId][log.date] = log.value;
      }

      const habitsWithHistory = userHabits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        category: habit.category,
        points: habit.points,
        type: habit.type,
        target: habit.target,
        unit: habit.unit,
        repeat: habit.repeat,
        repeatDays: habit.repeatDays ? JSON.parse(habit.repeatDays) : undefined,
        timeOfDay: habit.timeOfDay || undefined,
        timeBlock: habit.timeBlock || undefined,
        enableFocusTimer: habit.enableFocusTimer === 1,
        routineId: habit.routineId || undefined,
        createdAt: habit.createdAt,
        history: logsByHabitId[habit.id] || {},
      }));

      res.json(habitsWithHistory);
    } catch (err) {
      console.error("Fetch habits error:", err);
      res.status(500).json({ error: "Failed to fetch habits lists." });
    }
  });

  // Create habit
  app.post("/api/habits", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id, name, category, points, type, target, unit, repeat, repeatDays, timeOfDay, timeBlock, enableFocusTimer, routineId } = req.body;
    if (!name || !category || target === undefined) {
      return res.status(400).json({ error: "Missing required habit parameters." });
    }

    const newId = id || `habit-${Date.now()}`;
    const createdAtStr = new Date().toISOString().split("T")[0];

    try {
      await db.insert(habits).values({
        id: newId,
        userId: req.user!.uid,
        name,
        category,
        points: points || 10,
        type: type || "Count",
        target,
        unit: unit || "reps",
        repeat: repeat || "Daily",
        repeatDays: repeatDays ? JSON.stringify(repeatDays) : null,
        timeOfDay: timeOfDay || null,
        timeBlock: timeBlock || null,
        enableFocusTimer: enableFocusTimer ? 1 : 0,
        routineId: routineId || null,
        createdAt: createdAtStr,
      });

      res.status(201).json({
        id: newId,
        name,
        category,
        points: points || 10,
        type: type || "Count",
        target,
        unit: unit || "reps",
        repeat: repeat || "Daily",
        repeatDays,
        timeOfDay,
        timeBlock,
        enableFocusTimer: !!enableFocusTimer,
        routineId,
        createdAt: createdAtStr,
        history: {},
      });
    } catch (err: any) {
      console.error("Create habit error:", err);
      res.status(500).json({ error: "Database error setting up habit schema. " + err.message });
    }
  });

  // Log habit (increment)
  app.post("/api/habits/:id/log", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { date, value } = req.body;

    if (!date || value === undefined) {
      return res.status(400).json({ error: "Params 'date' and 'value' are required." });
    }

    try {
      const existingLogs = await db.select().from(habitLogs).where(
        and(
          eq(habitLogs.userId, req.user!.uid),
          eq(habitLogs.habitId, id),
          eq(habitLogs.date, date)
        )
      );

      let finalValue = parseFloat(value);
      if (existingLogs.length > 0) {
        finalValue += existingLogs[0].value;
        await db.update(habitLogs)
          .set({ value: finalValue })
          .where(eq(habitLogs.id, existingLogs[0].id));
      } else {
        await db.insert(habitLogs).values({
          habitId: id,
          userId: req.user!.uid,
          date,
          value: finalValue,
          pointsEarned: 0,
        });
      }

      res.json({ habitId: id, date, value: finalValue });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to record habit completion. " + err.message });
    }
  });

  // Set absolute habit log value
  app.post("/api/habits/:id/log-absolute", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { date, value } = req.body;

    if (!date || value === undefined) {
      return res.status(400).json({ error: "Params 'date' and 'value' are required." });
    }

    try {
      const existingLogs = await db.select().from(habitLogs).where(
        and(
          eq(habitLogs.userId, req.user!.uid),
          eq(habitLogs.habitId, id),
          eq(habitLogs.date, date)
        )
      );

      const finalValue = parseFloat(value);
      if (existingLogs.length > 0) {
        await db.update(habitLogs)
          .set({ value: finalValue })
          .where(eq(habitLogs.id, existingLogs[0].id));
      } else {
        await db.insert(habitLogs).values({
          habitId: id,
          userId: req.user!.uid,
          date,
          value: finalValue,
          pointsEarned: 0,
        });
      }

      res.json({ habitId: id, date, value: finalValue });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to log absolute habit capacity." });
    }
  });

  // Delete habit
  app.delete("/api/habits/:id", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const habitIdToDelete = req.params.id;
      const uid = req.user!.uid;

      // Delete the habit (cascade onDelete deletes habit_logs)
      await db.delete(habits).where(
        and(
          eq(habits.id, habitIdToDelete),
          eq(habits.userId, uid)
        )
      );

      // Clean up reference in any of the user's routines
      const userRoutines = await db.select().from(routines).where(eq(routines.userId, uid));
      for (const rt of userRoutines) {
        if (rt.habitIds) {
          try {
            const hIds = JSON.parse(rt.habitIds);
            if (Array.isArray(hIds) && hIds.includes(habitIdToDelete)) {
              await db.update(routines)
                .set({ habitIds: JSON.stringify(hIds.filter((id: string) => id !== habitIdToDelete)) })
                .where(eq(routines.id, rt.id));
            }
          } catch (e) {
            console.error("Failed to update routine habitIds list during habit deletion:", e);
          }
        }
      }

      res.json({ status: "success", message: "Habit destroyed securely and removed from routines." });
    } catch (err: any) {
      res.status(500).json({ error: "Failure while purging habit database records." });
    }
  });


  // 3. Routines Endpoints

  // Get routines
  app.get("/api/routines", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const [userRoutines, allLogs] = await Promise.all([
        db.select().from(routines).where(eq(routines.userId, uid)),
        db.select().from(routineLogs).where(eq(routineLogs.userId, uid)),
      ]);

      const logsByRoutineId: Record<string, Record<string, boolean>> = {};
      for (const log of allLogs) {
        if (!logsByRoutineId[log.routineId]) {
          logsByRoutineId[log.routineId] = {};
        }
        logsByRoutineId[log.routineId][log.date] = log.completed;
      }

      const routinesWithCompletedHistory = userRoutines.map((rt) => ({
        id: rt.id,
        name: rt.name,
        points: rt.points,
        timeBlock: rt.timeBlock,
        repeat: rt.repeat,
        repeatDays: rt.repeatDays ? JSON.parse(rt.repeatDays) : undefined,
        habitIds: rt.habitIds ? JSON.parse(rt.habitIds) : [],
        completedHistory: logsByRoutineId[rt.id] || {},
      }));

      res.json(routinesWithCompletedHistory);
    } catch (err: any) {
      console.error("Fetch routines error:", err);
      res.status(500).json({ error: "Failed to retrieve active routines roster." });
    }
  });

  // Create routine
  app.post("/api/routines", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id, name, points, timeBlock, repeat, repeatDays, habitIds } = req.body;
    if (!name || !timeBlock || !habitIds || !Array.isArray(habitIds)) {
      return res.status(400).json({ error: "Missing required routine properties." });
    }

    const newId = id || `rt-${Date.now()}`;
    const uid = req.user!.uid;

    try {
      await db.insert(routines).values({
        id: newId,
        userId: uid,
        name,
        points: points || 50,
        timeBlock,
        repeat: repeat || "Daily",
        repeatDays: repeatDays ? JSON.stringify(repeatDays) : null,
        habitIds: JSON.stringify(habitIds),
      });

      // Link any newly created habits to this routine id
      for (const hId of habitIds) {
        await db.update(habits)
          .set({ routineId: newId })
          .where(
            and(
              eq(habits.id, hId),
              eq(habits.userId, uid)
            )
          );
      }

      res.status(201).json({
        id: newId,
        name,
        points: points || 50,
        timeBlock,
        repeat,
        repeatDays,
        habitIds,
        completedHistory: {},
      });
    } catch (err: any) {
      res.status(500).json({ error: "Routine creation sequence failed. " + err.message });
    }
  });

  // Toggle routine completion status
  app.post("/api/routines/:id/status", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { date, completed } = req.body;

    if (!date || completed === undefined) {
      return res.status(400).json({ error: "Params 'date' and 'completed' parameter of boolean type is required." });
    }

    try {
      const existingLogs = await db.select().from(routineLogs).where(
        and(
          eq(routineLogs.userId, req.user!.uid),
          eq(routineLogs.routineId, id),
          eq(routineLogs.date, date)
        )
      );

      const statusVal = !!completed;
      if (existingLogs.length > 0) {
        await db.update(routineLogs)
          .set({ completed: statusVal })
          .where(eq(routineLogs.id, existingLogs[0].id));
      } else {
        await db.insert(routineLogs).values({
          routineId: id,
          userId: req.user!.uid,
          date,
          completed: statusVal,
        });
      }

      res.json({ routineId: id, date, completed: statusVal });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to record routine logging status. " + err.message });
    }
  });

  // Update routine
  app.put("/api/routines/:id", authenticateToken as any, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, points, timeBlock, repeat, repeatDays, habitIds } = req.body;
    const uid = req.user!.uid;

    try {
      const existing = await db.select().from(routines).where(
        and(
          eq(routines.id, id),
          eq(routines.userId, uid)
        )
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: "Routine not found." });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (points !== undefined) updateData.points = points;
      if (timeBlock !== undefined) updateData.timeBlock = timeBlock;
      if (repeat !== undefined) updateData.repeat = repeat;
      if (repeatDays !== undefined) updateData.repeatDays = repeatDays ? JSON.stringify(repeatDays) : null;
      if (habitIds !== undefined && Array.isArray(habitIds)) {
        updateData.habitIds = JSON.stringify(habitIds);

        // Unlink old habits that are no longer in this routine
        const oldHabitIds = existing[0].habitIds ? JSON.parse(existing[0].habitIds) : [];
        for (const oldId of oldHabitIds) {
          if (!habitIds.includes(oldId)) {
            await db.update(habits)
              .set({ routineId: null })
              .where(
                and(
                  eq(habits.id, oldId),
                  eq(habits.userId, uid)
                )
              );
          }
        }

        // Link new habits
        for (const newId of habitIds) {
          await db.update(habits)
            .set({ routineId: id })
            .where(
              and(
                eq(habits.id, newId),
                eq(habits.userId, uid)
              )
            );
        }
      }

      const [updatedRt] = await db.update(routines)
        .set(updateData)
        .where(eq(routines.id, id))
        .returning();

      res.json({
        id: updatedRt.id,
        name: updatedRt.name,
        points: updatedRt.points,
        timeBlock: updatedRt.timeBlock,
        repeat: updatedRt.repeat,
        repeatDays: updatedRt.repeatDays ? JSON.parse(updatedRt.repeatDays) : undefined,
        habitIds: updatedRt.habitIds ? JSON.parse(updatedRt.habitIds) : [],
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update routine. " + err.message });
    }
  });

  // Delete Routine
  app.delete("/api/routines/:id", authenticateToken as any, async (req: AuthRequest, res) => {
    try {
      const routineIdToDelete = req.params.id;
      const uid = req.user!.uid;

      // Unlink habits linked to this routine
      await db.update(habits)
        .set({ routineId: null })
        .where(
          and(
            eq(habits.routineId, routineIdToDelete),
            eq(habits.userId, uid)
          )
        );

      // Delete routine (cascade onDelete deletes routine_logs)
      await db.delete(routines).where(
        and(
          eq(routines.id, routineIdToDelete),
          eq(routines.userId, uid)
        )
      );

      res.json({ status: "success", message: "Routine disassembled safely. Linked habits preserved." });
    } catch (err: any) {
      res.status(500).json({ error: "Purging routines record registry failed." });
    }
  });

  return app;
}
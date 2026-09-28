const express = require("express");
const { z } = require("zod");

const pool = require("./db");
const { authenticate, requireAdmin } = require("./middleware");

const router = express.Router();

const createSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().int().min(0).max(23)
});

router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = createSessionSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Date and startHour are required."
        }
      });
    }

    const { date, startHour } = result.data;

    const startsAt = `${date}T${String(startHour).padStart(2, "0")}:00:00+05:30`;

    const sessionResult = await pool.query(
      `INSERT INTO sessions (starts_at, capacity)
       VALUES ($1, 20)
       RETURNING id, starts_at, capacity`,
      [startsAt]
    );

    res.status(201).json({
      message: "Session created successfully.",
      session: sessionResult.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: {
          code: "SESSION_EXISTS",
          message: "A session already exists at this time."
        }
      });
    }

    next(error);
  }
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { date } = req.query;

    if (date && !dateSchema.safeParse(date).success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Date must be in YYYY-MM-DD format."
        }
      });
    }

    const query = `
      SELECT
        s.id,
        s.starts_at,
        s.capacity,
        (
          s.capacity - COUNT(b.id)
        )::int AS seats_remaining
      FROM sessions s
      LEFT JOIN bookings b
        ON b.session_id = s.id
      ${date ? "WHERE (s.starts_at AT TIME ZONE 'Asia/Kolkata')::date = $1" : ""}
      GROUP BY s.id
      ORDER BY s.starts_at
    `;

    const values = date ? [date] : [];

    const result = await pool.query(query, values);

    res.json({
      sessions: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
const express = require("express");
const crypto = require("crypto");

const pool = require("./db");
const { authenticate } = require("./middleware");

const router = express.Router();

function generateBookingCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    const index = crypto.randomInt(0, characters.length);
    code += characters[index];
  }

  return code;
}

router.post("/sessions/:id/book", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const sessionId = Number(req.params.id);
    const memberId = req.user.userId;

    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Invalid session id."
        }
      });
    }

    await client.query("BEGIN");

    const sessionResult = await client.query(
      `SELECT id, starts_at, capacity
       FROM sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found."
        }
      });
    }

    const session = sessionResult.rows[0];

    if (new Date(session.starts_at) <= new Date()) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: {
          code: "SESSION_STARTED",
          message: "This session has already started."
        }
      });
    }

    const existingBooking = await client.query(
      `SELECT id
       FROM bookings
       WHERE session_id = $1 AND member_id = $2`,
      [sessionId, memberId]
    );

    if (existingBooking.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: {
          code: "ALREADY_BOOKED",
          message: "You already have a booking for this session."
        }
      });
    }

    const bookingCountResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM bookings
       WHERE session_id = $1`,
      [sessionId]
    );

    const bookingCount = bookingCountResult.rows[0].count;

    if (bookingCount >= session.capacity) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: {
          code: "SESSION_FULL",
          message: "This session is full."
        }
      });
    }

    const code = generateBookingCode();

    const bookingResult = await client.query(
      `INSERT INTO bookings (session_id, member_id, code)
       VALUES ($1, $2, $3)
       RETURNING id, session_id, member_id, code, checked_in, created_at`,
      [sessionId, memberId, code]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Session booked successfully.",
      booking: bookingResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
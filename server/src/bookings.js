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

// Join the waitlist for a full session
router.post("/sessions/:id/waitlist", authenticate, async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const sessionId = Number(req.params.id);
    const memberId = req.user.userId;

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Invalid session id."
        }
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    // Lock the session so simultaneous requests are handled safely.
    const sessionResult = await client.query(
      `SELECT id, starts_at, capacity
       FROM sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

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
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "SESSION_STARTED",
          message: "This session has already started."
        }
      });
    }

    // A member who already booked should not join the waitlist.
    const bookingResult = await client.query(
      `SELECT id
       FROM bookings
       WHERE session_id = $1 AND member_id = $2`,
      [sessionId, memberId]
    );

    if (bookingResult.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "ALREADY_BOOKED",
          message: "You already have a booking for this session."
        }
      });
    }

    // Check how many members have booked.
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM bookings
       WHERE session_id = $1`,
      [sessionId]
    );

    if (countResult.rows[0].count < session.capacity) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "SESSION_NOT_FULL",
          message: "Seats are available. Book the session directly."
        }
      });
    }

    // Prevent the same member joining twice.
    const existingEntry = await client.query(
      `SELECT id
       FROM waitlist
       WHERE session_id = $1 AND member_id = $2`,
      [sessionId, memberId]
    );

    if (existingEntry.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "ALREADY_WAITLISTED",
          message: "You have already joined this waitlist."
        }
      });
    }

    // Add the member to the end of the waitlist.
    const waitlistResult = await client.query(
      `INSERT INTO waitlist (session_id, member_id)
       VALUES ($1, $2)
       RETURNING id, session_id, member_id, joined_at`,
      [sessionId, memberId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "You have joined the waitlist successfully.",
      waitlistEntry: waitlistResult.rows[0]
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    // Handle the unique index as an extra duplicate safeguard.
    if (error.code === "23505") {
      return res.status(409).json({
        error: {
          code: "ALREADY_WAITLISTED",
          message: "You have already joined this waitlist."
        }
      });
    }

    next(error);
  } finally {
    client.release();
  }
});

// Cancel a booking and promote the next waitlisted member
router.delete("/bookings/:id", authenticate, async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const bookingId = Number(req.params.id);
    const memberId = req.user.userId;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Invalid booking id."
        }
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    // Find which session this booking belongs to.
    const initialBooking = await client.query(
      `SELECT session_id
       FROM bookings
       WHERE id = $1`,
      [bookingId]
    );

    if (initialBooking.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: {
          code: "BOOKING_NOT_FOUND",
          message: "Booking not found."
        }
      });
    }

    const sessionId = initialBooking.rows[0].session_id;

    // Lock the session so booking and cancellation requests
    // cannot change its availability at the same time.
    const sessionResult = await client.query(
      `SELECT id, starts_at
       FROM sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found."
        }
      });
    }

    const session = sessionResult.rows[0];

    // Check the booking again after locking the session.
    const bookingResult = await client.query(
      `SELECT id, session_id, member_id, checked_in
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: {
          code: "BOOKING_NOT_FOUND",
          message: "Booking not found."
        }
      });
    }

    const booking = bookingResult.rows[0];

    // Members can cancel only their own bookings.
    if (String(booking.member_id) !== String(memberId)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only cancel your own booking."
        }
      });
    }

    if (booking.checked_in) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "ALREADY_CHECKED_IN",
          message: "A checked-in booking cannot be cancelled."
        }
      });
    }

    if (new Date(session.starts_at) <= new Date()) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: {
          code: "SESSION_STARTED",
          message: "A booking cannot be cancelled after the session starts."
        }
      });
    }

    // Cancel the member's booking.
    await client.query(
      `DELETE FROM bookings
       WHERE id = $1`,
      [bookingId]
    );

    // Find the earliest waitlist entry.
    const waitlistResult = await client.query(
      `SELECT id, member_id
       FROM waitlist
       WHERE session_id = $1
       ORDER BY joined_at ASC, id ASC
       LIMIT 1
       FOR UPDATE`,
      [sessionId]
    );

    let promotedBooking = null;

    if (waitlistResult.rows.length > 0) {
      const nextMember = waitlistResult.rows[0];

      // Remove that member from the waitlist.
      await client.query(
        `DELETE FROM waitlist
         WHERE id = $1`,
        [nextMember.id]
      );

      // Give the newly available seat to that member.
      const promotionResult = await client.query(
        `INSERT INTO bookings (session_id, member_id, code)
         VALUES ($1, $2, $3)
         RETURNING id, session_id, member_id, code, checked_in, created_at`,
        [sessionId, nextMember.member_id, generateBookingCode()]
      );

      promotedBooking = promotionResult.rows[0];
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Booking cancelled successfully.",
      promoted: Boolean(promotedBooking),
      promotedBooking
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    next(error);
  } finally {
    client.release();
  }
});

// Get bookings belonging to the logged-in member
router.get("/bookings", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         b.id,
         b.session_id,
         b.code,
         b.checked_in,
         b.created_at,
         s.starts_at
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       WHERE b.member_id = $1
       ORDER BY s.starts_at ASC`,
      [req.user.userId]
    );

    res.json({
      bookings: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get waitlist entries for the logged-in member
router.get("/waitlist", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         w.id,
         w.session_id,
         w.joined_at,
         s.starts_at
       FROM waitlist w
       JOIN sessions s ON s.id = w.session_id
       WHERE w.member_id = $1
       ORDER BY s.starts_at ASC`,
      [req.user.userId]
    );

    res.json({
      waitlist: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
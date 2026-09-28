const express = require("express");
const authRoutes = require("./auth");
const sessionRoutes = require("./sessions");
const bookingRoutes = require("./bookings");
const { authenticate, requireAdmin } = require("./middleware");

const app = express();

app.use(express.json());


app.get("/", (req, res) => {
  res.json({
    message: "FitQueue API is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api", bookingRoutes);
app.get("/api/me", authenticate, (req, res) => {
  res.json({
    user: req.user
  });
});

app.get("/api/admin/test", authenticate, requireAdmin, (req, res) => {
  res.json({
    message: "Admin access granted."
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong."
    }
  });
});

module.exports = app;
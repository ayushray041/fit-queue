require("dotenv").config();

const app = require("./app");
const pool = require("./db");

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`FitQueue API running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
});
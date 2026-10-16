require("dotenv").config();

try {
  const dbUrl = new URL(process.env.DATABASE_URL);

  console.log("[DB CONFIG CHECK]", {
    host: dbUrl.hostname,
    port: dbUrl.port || "5432",
    usernameIsPostgresOnly: dbUrl.username === "postgres",
    usernameHasProjectRef: dbUrl.username.startsWith("postgres."),
    passwordPresent: Boolean(dbUrl.password),
  });
} catch {
  console.log("[DB CONFIG CHECK] DATABASE_URL is missing or invalid");
}

const app = require("./app");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`FitQueue API running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error.message);
});
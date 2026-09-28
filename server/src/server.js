require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`FitQueue API running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error.message);
});
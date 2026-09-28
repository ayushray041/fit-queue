require("dotenv").config();

const u = new URL(process.env.DATABASE_URL);

console.log({
  user: u.username,
  host: u.hostname,
  port: u.port,
  database: u.pathname.slice(1),
  hasPassword: !!u.password
});
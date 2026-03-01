import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("planner.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    difficulty TEXT,
    date TEXT,
    completed INTEGER,
    completedAt TEXT,
    createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS savings (
    id TEXT PRIMARY KEY,
    userId TEXT,
    amount REAL,
    description TEXT,
    date TEXT,
    createdAt TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const userId = req.query.userId;
    const tasks = db.prepare("SELECT * FROM tasks WHERE userId = ?").all(userId);
    res.json(tasks.map(t => ({ ...t, completed: !!t.completed })));
  });

  app.post("/api/tasks", (req, res) => {
    const task = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tasks (id, userId, name, difficulty, date, completed, completedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(task.id, task.userId, task.name, task.difficulty, task.date, task.completed ? 1 : 0, task.completedAt, task.createdAt);
    res.json({ status: "ok" });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  app.get("/api/savings", (req, res) => {
    const userId = req.query.userId;
    const savings = db.prepare("SELECT * FROM savings WHERE userId = ?").all(userId);
    res.json(savings);
  });

  app.post("/api/savings", (req, res) => {
    const saving = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO savings (id, userId, amount, description, date, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(saving.id, saving.userId, saving.amount, saving.description, saving.date, saving.createdAt);
    res.json({ status: "ok" });
  });

  app.delete("/api/savings/:id", (req, res) => {
    db.prepare("DELETE FROM savings WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

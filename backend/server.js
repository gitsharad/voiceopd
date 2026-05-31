const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const logger = require("./utils/logger");
const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const patientRoutes = require("./routes/patient.routes");
const tokenRoutes = require("./routes/token.routes");
const prescriptionRoutes = require("./routes/prescription.routes");
const visitRoutes = require("./routes/visit.routes");
const reportRoutes = require("./routes/report.routes");
const clinicRoutes = require("./routes/clinic.routes");
const aiRoutes    = require("./routes/ai.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const server = http.createServer(app);

// ─── Allowed origins (supports comma-separated list in CLIENT_URL) ─────────────
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:4400")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};

// Socket.IO for real-time token updates
const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

// Attach io to app so controllers can emit events
app.set("io", io);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }),
);

// Global rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use("/api/", limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/clinic", clinicRoutes);
app.use("/api/ai",    aiRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "VoiceOPD API is running",
    timestamp: new Date().toISOString(),
    dbState:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on("join-clinic", (clinicId) => {
    socket.join(`clinic-${clinicId}`);
    logger.info(`Socket ${socket.id} joined clinic-${clinicId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(
        `VoiceOPD Server running on port ${PORT} [${process.env.NODE_ENV}]`,
      );
    });
  })
  .catch((err) => {
    logger.error("Failed to connect to database", err);
    process.exit(1);
  });

module.exports = { app, server };

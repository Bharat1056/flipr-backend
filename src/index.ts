import dotenv from "dotenv";
import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { setupSocketIO } from "./lib/socket";

dotenv.config({ path: ".env" });

const PORT = process.env.PORT || 8000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Attach socket.io events
setupSocketIO(io);

// Start HTTP server (Express + Socket.IO)
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// Optional: Handle app-level errors
app.on("error", (error) => {
  console.log("Express encountered an error:", error);
  throw error;
});

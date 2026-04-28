import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // In-memory store for demo (simulating Redis/Postgres)
  const incidents: any[] = [
    { id: 'h1', location: { lat: 40.7128, lng: -74.0060 }, crowd_level: 85, noise_db: 92, status: 'active', serverTimestamp: new Date().toISOString() },
    { id: 'h2', location: { lat: 40.7130, lng: -74.0062 }, crowd_level: 90, noise_db: 95, status: 'active', serverTimestamp: new Date().toISOString() },
    { id: 'h3', location: { lat: 40.7125, lng: -74.0058 }, crowd_level: 70, noise_db: 85, status: 'active', serverTimestamp: new Date().toISOString() }
  ];
  const riskHeatmap: any[] = [];
  const blockedNodes = new Set<string>();

  // Admin / Role Management (Simulated)
  const administrators = [
    { id: 'gbm3914', email: 'gbm3914@gmail.com', role: 'superadmin' }
  ];

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "QuantumLink", version: "2.4.0-edge" });
  });

  // Role Access Verification
  app.post("/api/admin/verify-role", (req, res) => {
    const { admin_id, action, totp_code } = req.body;
    
    // Simulation: check totp 123456
    if (totp_code === "123456") {
      res.json({ success: true, message: `Access granted for ${action}` });
    } else {
      res.status(401).json({ success: false, error: "Invalid TOTP code" });
    }
  });

  app.get("/api/admin/users", (req, res) => {
    // Return mock users for demo
    res.json([
      { id: '1', name: 'SuperAdmin', role: 'superadmin', email: 'gbm3914@gmail.com' },
      { id: '2', name: 'Duty Officer', role: 'admin', email: 'officer@guardian.hq' },
      { id: '3', name: 'Unit 404', role: 'responder', email: 'r404@guardian.hq' }
    ]);
  });

  app.post("/api/admin/users/invite", (req, res) => {
    const { email, role, name } = req.body;
    console.log(`[INVITE] Sent to ${email} as ${role}`);
    res.status(201).json({ success: true, message: "Invite dispatched" });
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    res.json({ success: true, message: "User access revoked" });
  });

  app.post("/api/alerts", (req, res) => {
    const alert = req.body;
    alert.id = Math.random().toString(36).substr(2, 9);
    alert.serverTimestamp = new Date().toISOString();
    alert.status = "active";
    incidents.push(alert);

    // Smart Routing Logic
    io.emit("new_alert", alert);
    
    // QuantumLink Analysis
    if (alert.crowd_level > 80 && alert.noise_db > 90) {
      io.emit("system_broadcast", {
        type: "high_risk_warning",
        zoneId: "sector_g",
        message: "Heavy congestion & elevated noise detected. Precision evacuation activated."
      });
    }

    res.status(202).json({ status: "received", incident_id: alert.id });
  });

  app.get("/api/heatmap", (req, res) => {
    // Aggregate incidents into heatmap format
    const intensityMap = incidents.reduce((acc, inc) => {
      if (inc && inc.location && typeof inc.location.lat === 'number' && typeof inc.location.lng === 'number') {
        const key = `${Math.floor(inc.location.lat * 100) / 100}_${Math.floor(inc.location.lng * 100) / 100}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    const heatmap = Object.entries(intensityMap).map(([key, count]) => {
      const [lat, lng] = key.split("_").map(Number);
      return { lat, lng, intensity: count };
    });

    res.json(heatmap);
  });

  // WebSocket for Real-time Ops
  io.on("connection", (socket) => {
    console.log("Admin node connected:", socket.id);
    
    socket.emit("initial_state", {
      incidents: incidents.filter(i => i.status !== "resolved"),
      blockedNodes: Array.from(blockedNodes)
    });

    socket.on("admin_action", (action) => {
      if (action.type === "resolve") {
        const idx = incidents.findIndex(i => i.id === action.incident_id);
        if (idx !== -1) incidents[idx].status = "resolved";
        io.emit("incident_resolved", action.incident_id);
      } else if (action.type === "block_exit") {
        blockedNodes.add(action.node_id);
        io.emit("exit_blocked", action.node_id);
      }
    });
  });

  // 24-hour cleanup cron (simulated with interval)
  setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const initialCount = incidents.length;
    for (let i = incidents.length - 1; i >= 0; i--) {
      if (new Date(incidents[i].serverTimestamp).getTime() < cutoff) {
        incidents.splice(i, 1);
      }
    }
    if (incidents.length < initialCount) {
      console.log(`Privacy Sweep: Purged ${initialCount - incidents.length} stale records.`);
    }
  }, 3600000); // Hourly check

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

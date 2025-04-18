#!/usr/bin/env node

const { Command } = require("commander");
const { Server } = require("socket.io");
const http = require("http");
const pty = require("node-pty");
const os = require("os");

const program = new Command();

program
  .name("run-terminal")
  .description("Start CodeNoKami Terminal Server")
  .version("1.0.0");

program.option('--port <port>', 'Port number', '3000');

program.action(() => {
  const port = parseInt(program.opts().port, 10);
  
  // Vanilla HTTP server
  const server = http.createServer((req, res) => {
    // Handle /ping route
    if (req.method === "GET" && req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Global session storage
  const globalSessions = new Map();

  io.on("connection", (socket) => {
    console.log(`[+] Client connected (${socket.id})`);

    // Each socket manages its own active sessions
    const sessions = {};

    // Open a new terminal session
    socket.on("open-session", () => {
      const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
      const term = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env,
      });

      const sessionId = Date.now().toString();
      sessions[sessionId] = term;
      globalSessions.set(sessionId, { term, createdAt: Date.now() });

      console.log(`[+] New terminal session: ${sessionId}`);

      term.on("data", (data) => {
        socket.emit("data", { sessionId, data });
      });

      socket.emit("session-created", sessionId);
    });

    // Resume existing terminal session
    socket.on("resume-session", (sessionId) => {
      const existing = globalSessions.get(sessionId);
      if (existing) {
        sessions[sessionId] = existing.term;
        console.log(`[~] Resumed session: ${sessionId}`);

        existing.term.on("data", (data) => {
          socket.emit("data", { sessionId, data });
        });

        socket.emit("session-resumed", sessionId);
      } else {
        console.log(`[x] Session not found: ${sessionId}`);
        socket.emit("session-not-found", sessionId);
      }
    });

    // Send input to terminal
    socket.on("data", ({ sessionId, data }) => {
      const term = sessions[sessionId];
      if (term) {
        term.write(data);
      }
    });

    // Close a session manually
    socket.on("close-session", (sessionId) => {
      const term = sessions[sessionId];
      if (term) {
        console.log(`[-] Closing session: ${sessionId}`);
        term.kill();
        delete sessions[sessionId];
        globalSessions.delete(sessionId);
      }
    });

    // Disconnect: kill all user sessions
    socket.on("disconnect", () => {
      console.log(`[-] Client disconnected (${socket.id})`);
      Object.keys(sessions).forEach((sessionId) => {
        if (sessions[sessionId]) {
          sessions[sessionId].kill();
          globalSessions.delete(sessionId);
        }
      });
    });
  });

  server.listen(port, () => {
    console.log(`[*] CodeNoKami Terminal Server running on http://localhost:${port}`);
  });
});

program.parse(process.argv);

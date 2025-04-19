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

  // HTTP Server for ping check
  const server = http.createServer((req, res) => {
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

  const globalSessions = new Map();

  io.on("connection", (socket) => {
    console.log(`[+] Client connected (${socket.id})`);

    const sessions = {};

    // Open new terminal session
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

      socket.emit("session-created", {
        sessionId,
        shortId: sessionId.slice(-4) // last 4 digits for UI rendering
      });
    });

    // Resume terminal session
    socket.on("resume-session", (sessionId) => {
      const existing = globalSessions.get(sessionId);
      if (existing) {
        const term = existing.term;
        sessions[sessionId] = term;

        // Remove old listeners and rebind for current socket
        term.removeAllListeners("data");

        term.on("data", (data) => {
          socket.emit("data", { sessionId, data });
        });

        // Listen for input to this terminal
        socket.on("data", ({ sessionId: incomingId, data }) => {
          if (incomingId === sessionId && sessions[incomingId]) {
            sessions[incomingId].write(data);
          }
        });

        console.log(`[~] Resumed session: ${sessionId}`);
        socket.emit("session-resumed", {
          sessionId,
          shortId: sessionId.slice(-4)
        });
      } else {
        console.log(`[x] Session not found: ${sessionId}`);
        socket.emit("session-not-found", sessionId);
      }
    });

    // Receive input
    socket.on("data", ({ sessionId, data }) => {
      const term = sessions[sessionId];
      if (term) {
        term.write(data);
      }
    });

    // Manual close session
    socket.on("close-session", (sessionId) => {
      const term = sessions[sessionId];
      if (term) {
        console.log(`[-] Closing session: ${sessionId}`);
        term.kill();
        delete sessions[sessionId];
        globalSessions.delete(sessionId);
      }
    });

    // On client disconnect
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

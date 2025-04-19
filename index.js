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

  const globalSessions = new Map(); // sessionId => { term, createdAt }

  io.on("connection", (socket) => {
    console.log(`[+] Client connected (${socket.id})`);

    // Create new session
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
      globalSessions.set(sessionId, { term, createdAt: Date.now() });

      console.log(`[+] New session: ${sessionId}`);

      // Emit new session info
      socket.emit("session-created", {
        sessionId,
        shortId: sessionId.slice(-4)
      });

      // Emit term data to client
      term.on("data", (data) => {
        socket.emit("data", { sessionId, data });
      });

      // Listen for client input
      socket.on("data", ({ sessionId: sid, data }) => {
        const s = globalSessions.get(sid);
        if (s) s.term.write(data);
      });

      // Resize event
      socket.on("resize", ({ sessionId: sid, cols, rows }) => {
        const s = globalSessions.get(sid);
        if (s) s.term.resize(cols, rows);
      });

      // Close manually
      socket.on("close-session", (sid) => {
        const s = globalSessions.get(sid);
        if (s) {
          s.term.kill();
          globalSessions.delete(sid);
          console.log(`[-] Session closed: ${sid}`);
        }
      });
    });

    // Resume session
    socket.on("resume-session", (sessionId) => {
      const session = globalSessions.get(sessionId);
      if (session) {
        const term = session.term;

        // Remove old listeners before binding again
        term.removeAllListeners("data");

        // Term output to client
        term.on("data", (data) => {
          socket.emit("data", { sessionId, data });
        });

        // Input from client
        socket.on("data", ({ sessionId: sid, data }) => {
          if (sid === sessionId) {
            term.write(data);
          }
        });

        socket.on("resize", ({ sessionId: sid, cols, rows }) => {
          if (sid === sessionId) {
            term.resize(cols, rows);
          }
        });

        socket.emit("session-resumed", {
          sessionId,
          shortId: sessionId.slice(-4)
        });

        console.log(`[~] Session resumed: ${sessionId}`);
      } else {
        console.log(`[x] Resume failed: ${sessionId}`);
        socket.emit("session-not-found", sessionId);
      }
    });

    // Don't kill session on disconnect — allow resume
    socket.on("disconnect", () => {
      console.log(`[-] Client disconnected (${socket.id})`);
    });
  });

  // Auto-kill stale sessions (30 mins)
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of globalSessions.entries()) {
      if (now - session.createdAt > 30 * 60 * 1000) {
        session.term.kill();
        globalSessions.delete(sessionId);
        console.log(`[-] Auto-killed stale session: ${sessionId}`);
      }
    }
  }, 10 * 60 * 1000);

  server.listen(port, () => {
    console.log(`[*] CodeNoKami Terminal Server running on http://localhost:${port}`);
  });
});

program.parse(process.argv);

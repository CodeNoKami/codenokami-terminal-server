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
  const server = http.createServer();
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const clients = new Map();

  io.on("connection", (socket) => {
    console.log(`[+] Client connected (${socket.id})`);
    const sessions = {};

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

      console.log(`[+] New terminal session: ${sessionId}`);

      term.on("data", (data) => {
        socket.emit("data", { sessionId, data });
      });

      socket.emit("session-created", sessionId);
    });

    socket.on("data", ({ sessionId, data }) => {
      if (sessions[sessionId]) {
        sessions[sessionId].write(data);
      }
    });

    socket.on("close-session", (sessionId) => {
      const term = sessions[sessionId];
      if (term) {
        console.log(`[-] Closing session: ${sessionId}`);
        term.kill();
        delete sessions[sessionId];
      }
    });

    socket.on("disconnect", () => {
      console.log(`[-] Client disconnected (${socket.id})`);
      // Cleanup all terminals for this client
      Object.keys(sessions).forEach((sessionId) => {
        sessions[sessionId].kill();
      });
    });
  });

  server.listen(port, () => {
    console.log(`[*] CodeNoKami Terminal Server running on http://localhost:${port}`);
  });
});

program.parse(process.argv);

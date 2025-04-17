#!/usr/bin/env node

const { Command } = require("commander");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const program = new Command();

program
  .name("run-terminal")
  .description("Start CodeNoKami Terminal Server")
  .version("1.0.0");

program.option('--port <port>', 'Port number', '3000');

program.action(() => {
  const port = program.opts().port;
  const wss = new WebSocketServer({ port });

  console.log(`[*] CodeNoKami Terminal Server running on ws://localhost:${port}`);

  let sessionCount = 0;

  wss.on("connection", (ws) => {
    if (!ws || ws.readyState !== 1) return;

    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env,
    });

    sessionCount++;
    console.log(`[+] New session started (${sessionCount} total)`);

    ptyProcess.on("data", (data) => {
      ws.send(data);
    });

    ws.on("message", (msg) => {
      ptyProcess.write(msg);
    });

    ws.on("close", () => {
      console.log("[-] Session closed");
      ptyProcess.kill();
      sessionCount--;
    });
  });
});

program.parse(process.argv);
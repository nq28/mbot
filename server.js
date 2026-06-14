const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const BotManager = require("./bot-manager");
const DiscordBot = require("./discord-bot");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const botManager = new BotManager((type, data) => {
  if (type === "log") {
    io.emit("log", data);
    console.log(data);
  } else if (type === "chat") {
    io.emit("chat", data);
  } else if (type === "bots_update") {
    io.emit("bots_update", data);
  }
});

let discordBot = null;

function startDiscordBot(token) {
  if (discordBot) {
    discordBot.stop();
    discordBot = null;
  }
  discordBot = new DiscordBot(token, botManager, (msg) => {
    io.emit("log", msg);
    console.log(msg);
  }, (connected) => {
    io.emit("discord_status", { connected });
  });
  discordBot.start();
  return true;
}

function stopDiscordBot() {
  if (discordBot) {
    discordBot.stop();
    discordBot = null;
  }
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || null;
if (DISCORD_TOKEN) {
  startDiscordBot(DISCORD_TOKEN);
}

io.on("connection", (socket) => {
  socket.emit("log", "[*] Connected to web server");
  socket.emit("bots_update", botManager.getBotsList());
  socket.emit("discord_status", { connected: discordBot ? discordBot.ready : false });

  socket.on("create_bot", (name) => {
    botManager.createBot(name);
  });

  socket.on("join_server", (data) => {
    botManager.joinServer(data.name, data.host, data.port);
  });

  socket.on("leave_server", (name) => {
    botManager.leaveServer(name);
  });

  socket.on("bot_chat", (data) => {
    botManager.sendChat(data.name, data.message);
  });

  socket.on("delete_bot", (name) => {
    botManager.leaveServer(name);
    delete botManager.bots[name];
    botManager.emit("log", `[-] Bot "${name}" deleted`);
    botManager.emit("bots_update", botManager.getBotsList());
  });

  socket.on("discord_connect", (token) => {
    if (!token || token.trim() === "") {
      socket.emit("log", "[!] Invalid Discord token");
      return;
    }
    startDiscordBot(token.trim());
    socket.emit("log", "[*] Discord bot connecting...");
    setTimeout(() => {
      socket.emit("discord_status", { connected: discordBot ? discordBot.ready : false });
    }, 5000);
  });

  socket.on("discord_disconnect", () => {
    stopDiscordBot();
    socket.emit("log", "[*] Discord bot disconnected");
    socket.emit("discord_status", { connected: false });
  });
});

const PORT = process.env.PORT || process.env.WEB_PORT || 3000;
const os = require("os");

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function findPort(start, cb) {
  const s = http.createServer();
  s.listen(start, "0.0.0.0", () => {
    const port = s.address().port;
    s.close(() => cb(port));
  });
  s.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      s.close(() => findPort(start + 1, cb));
    } else {
      console.error(`[!] Server error: ${err.message}`);
    }
  });
}

findPort(PORT, (port) => {
  server.listen(port, "0.0.0.0", () => {
    const ip = getLocalIP();
    console.log(`[*] Web server running at http://0.0.0.0:${port}`);
    console.log(`[*] Local:   http://127.0.0.1:${port}`);
    console.log(`[*] Network: http://${ip}:${port}`);
    require("fs").writeFileSync(
      path.join(__dirname, "server-status.txt"),
      `RUNNING:${ip}:${port}`
    );
  });
  server.on("error", (err) => {
    console.error(`[!] Server error: ${err.message}`);
  });
});

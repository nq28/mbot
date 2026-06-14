const mineflayer = require("mineflayer");

class BotManager {
  constructor(onEvent) {
    this.bots = {};
    this.antiAfkIntervals = {};
    this.onEvent = onEvent || (() => {});
  }

  emit(type, data) {
    this.onEvent(type, data);
  }

  createBot(name) {
    if (this.bots[name]) {
      this.emit("log", `[!] Bot "${name}" already exists`);
      return false;
    }
    this.bots[name] = { instance: null, status: "idle" };
    this.emit("log", `[+] Bot "${name}" created (idle)`);
    this.emit("bots_update", this.getBotsList());
    return true;
  }

  joinServer(name, host, port) {
    const entry = this.bots[name];
    if (!entry) {
      this.emit("log", `[!] Bot "${name}" not found. Use /creatembot first`);
      return false;
    }
    if (entry.instance) {
      this.emit("log", `[!] Bot "${name}" is already connected`);
      return false;
    }

    this.emit("log", `[*] Bot "${name}" connecting to ${host}:${port}...`);

    const bot = mineflayer.createBot({
      host,
      port: parseInt(port) || 25565,
      username: name,
    });

    entry.instance = bot;
    entry.status = "connecting";
    entry.host = host;
    entry.port = port;
    this.emit("bots_update", this.getBotsList());

    bot.on("login", () => {
      entry.status = "online";
      this.emit("log", `[+] Bot "${name}" logged in as ${bot.username}`);
      this.emit("bots_update", this.getBotsList());
      this.startAntiAfk(name);
    });

    bot.on("message", (message) => {
      const text = message.toString();
      this.emit("chat", { bot: name, text });
      this.emit("log", `[${name} CHAT] ${text}`);
    });

    bot.on("playerJoined", (player) => {
      this.emit("log", `[${name}] ${player.username} joined the game`);
    });

    bot.on("playerLeft", (player) => {
      this.emit("log", `[${name}] ${player.left ?? player.username} left`);
    });

    bot.on("kicked", (reason) => {
      this.emit("log", `[!] Bot "${name}" kicked: ${reason}`);
      this.cleanupBot(name);
    });

    bot.on("error", (err) => {
      this.emit("log", `[!] Bot "${name}" error: ${err.message}`);
      this.cleanupBot(name);
    });

    bot.on("end", () => {
      this.emit("log", `[-] Bot "${name}" disconnected`);
      this.cleanupBot(name);
    });

    bot.on("spawn", () => {
      this.emit("log", `[+] Bot "${name}" spawned in world`);
    });

    return true;
  }

  leaveServer(name) {
    const entry = this.bots[name];
    if (!entry) {
      this.emit("log", `[!] Bot "${name}" not found`);
      return false;
    }
    if (!entry.instance) {
      this.emit("log", `[!] Bot "${name}" is not connected`);
      return false;
    }
    this.emit("log", `[*] Bot "${name}" disconnecting...`);
    this.cleanupBot(name);
    entry.status = "idle";
    this.emit("bots_update", this.getBotsList());
    return true;
  }

  sendChat(name, message) {
    const entry = this.bots[name];
    if (!entry || !entry.instance || !entry.instance.entity) {
      this.emit("log", `[!] Bot "${name}" is not connected`);
      return false;
    }
    entry.instance.chat(message);
    this.emit("log", `[${name} YOU] ${message}`);
    return true;
  }

  startAntiAfk(name) {
    this.stopAntiAfk(name);
    this.antiAfkIntervals[name] = setInterval(() => {
      const entry = this.bots[name];
      if (entry && entry.instance && entry.instance.entity) {
        entry.instance.setControlState("jump", true);
        setTimeout(() => entry.instance.setControlState("jump", false), 200);
        entry.instance.setControlState("forward", true);
        setTimeout(() => entry.instance.setControlState("forward", false), 500);
      }
    }, 30000);
  }

  stopAntiAfk(name) {
    if (this.antiAfkIntervals[name]) {
      clearInterval(this.antiAfkIntervals[name]);
      delete this.antiAfkIntervals[name];
    }
  }

  cleanupBot(name) {
    const entry = this.bots[name];
    if (!entry) return;
    this.stopAntiAfk(name);
    if (entry.instance) {
      try { entry.instance.end(); } catch (_) {}
      entry.instance = null;
    }
    entry.status = "idle";
    delete entry.host;
    delete entry.port;
    this.emit("bots_update", this.getBotsList());
  }

  getBotsList() {
    const list = {};
    for (const [name, entry] of Object.entries(this.bots)) {
      list[name] = {
        status: entry.status,
        host: entry.host || null,
        port: entry.port || null,
      };
    }
    return list;
  }

  destroy() {
    for (const name of Object.keys(this.bots)) {
      this.cleanupBot(name);
    }
    this.bots = {};
  }
}

module.exports = BotManager;

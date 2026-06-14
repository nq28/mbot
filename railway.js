const readline = require("readline");
const os = require("os");
const BotManager = require("./bot-manager");
const DiscordBot = require("./discord-bot");

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "railway> ",
});

const botManager = new BotManager((type, data) => {
  if (type === "log") console.log(data);
  else if (type === "chat") console.log(`[CHAT] ${data.text}`);
});

let discordBot = null;

function printHelp() {
  console.log(`
╔══════════════════════════════════════════╗
║       BotControl - Railway Console       ║
╠══════════════════════════════════════════╣
║ Commands:                                ║
║  help                        Show this   ║
║  create <name>               Create bot  ║
║  join <name> <host:port>     Join server ║
║  leave <name>                Leave       ║
║  chat <name> <message>       Send chat   ║
║  list                        List bots   ║
║  discord <token>             Connect DC  ║
║  discord-stop                Disconnect  ║
║  web                         Show URL    ║
║  port                        Show port   ║
║  exit                        Exit        ║
╚══════════════════════════════════════════╝`);
}

function cmdCreate(args) {
  if (!args.length) return console.log("Usage: create <name>");
  botManager.createBot(args[0]);
}

function cmdJoin(args) {
  if (args.length < 2) return console.log("Usage: join <name> <host:port>");
  const name = args[0];
  const addr = args[1];
  let host = addr, port = "25565";
  if (addr.includes(":")) {
    host = addr.split(":")[0];
    port = addr.split(":")[1];
  }
  botManager.joinServer(name, host, port);
}

function cmdLeave(args) {
  if (!args.length) return console.log("Usage: leave <name>");
  botManager.leaveServer(args[0]);
}

function cmdChat(args) {
  if (args.length < 2) return console.log("Usage: chat <name> <message>");
  const name = args[0];
  const msg = args.slice(1).join(" ");
  botManager.sendChat(name, msg);
}

function cmdList() {
  const bots = botManager.getBotsList();
  const names = Object.keys(bots);
  if (!names.length) return console.log("No bots created.");
  console.log("\nBots:");
  names.forEach((n) => {
    const b = bots[n];
    const status = b.status === "online" ? "ONLINE" : b.status === "connecting" ? "CONNECTING" : "IDLE";
    console.log(`  ${status === "ONLINE" ? "🟢" : "⚪"} ${n}  ${status}  ${b.host ? b.host + ":" + b.port : "-"}`);
  });
}

function cmdDiscord(args) {
  if (!args.length) return console.log("Usage: discord <token>");
  const token = args[0];
  if (discordBot) {
    discordBot.stop();
    discordBot = null;
  }
  discordBot = new DiscordBot(
    token,
    botManager,
    (msg) => console.log(msg),
    (connected) => console.log(connected ? "[+] Discord connected" : "[-] Discord disconnected")
  );
  discordBot.start();
}

function cmdDiscordStop() {
  if (discordBot) {
    discordBot.stop();
    discordBot = null;
    console.log("[-] Discord bot stopped");
  } else {
    console.log("[!] No Discord bot running");
  }
}

function cmdPort() {
  console.log(`PORT: ${process.env.PORT || process.env.WEB_PORT || "3000"}`);
}

console.log(`BotControl Railway Console
Type 'help' for commands\n`);

rl.prompt();

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) { rl.prompt(); return; }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":
      printHelp();
      break;
    case "create":
      cmdCreate(args);
      break;
    case "join":
      cmdJoin(args);
      break;
    case "leave":
      cmdLeave(args);
      break;
    case "chat":
      cmdChat(args);
      break;
    case "list":
      cmdList();
      break;
    case "discord":
      if (args.length === 0) {
        console.log("Usage: discord <token>");
      } else {
        cmdDiscord(args);
      }
      break;
    case "discord-stop":
      cmdDiscordStop();
      break;
    case "web":
      console.log(`Web URL: http://${getLocalIP()}:${process.env.PORT || process.env.WEB_PORT || "3000"}`);
      break;
    case "port":
      cmdPort();
      break;
    case "exit":
    case "quit":
      console.log("Goodbye!");
      process.exit(0);
      break;
    default:
      console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("Goodbye!");
  process.exit(0);
});

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");

class DiscordBot {
  constructor(token, botManager, onLog, onStatus) {
    this.token = token;
    this.botManager = botManager;
    this.onLog = onLog || (() => {});
    this.onStatus = onStatus || (() => {});
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ],
    });
    this.consoleLogs = [];
    this.maxLogs = 200;
    this.ready = false;
  }

  log(msg) {
    this.consoleLogs.push(msg);
    if (this.consoleLogs.length > this.maxLogs) {
      this.consoleLogs.shift();
    }
    this.onLog(msg);
  }

  async start() {
    this.client.once("ready", async () => {
      this.ready = true;
      this.onStatus(true);
      this.log(`[+] Discord bot logged in as ${this.client.user.tag}`);

      const commands = [
        new SlashCommandBuilder()
          .setName("creatembot")
          .setDescription("Create a new Minecraft bot")
          .addStringOption((opt) =>
            opt.setName("botname").setDescription("Bot name").setRequired(true)
          ),
        new SlashCommandBuilder()
          .setName("mjoin")
          .setDescription("Make a bot join a Minecraft server")
          .addStringOption((opt) =>
            opt.setName("botname").setDescription("Bot name").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("address").setDescription("Server IP:Port").setRequired(true)
          ),
        new SlashCommandBuilder()
          .setName("mleave")
          .setDescription("Make a bot leave the server")
          .addStringOption((opt) =>
            opt.setName("botname").setDescription("Bot name").setRequired(true)
          ),
        new SlashCommandBuilder()
          .setName("console")
          .setDescription("Show recent console logs"),
        new SlashCommandBuilder()
          .setName("mbots")
          .setDescription("List all bots and their status"),
      ];

      try {
        const rest = new REST({ version: "10" }).setToken(this.token);
        await rest.put(Routes.applicationCommands(this.client.user.id), {
          body: commands,
        });
        this.log("[+] Slash commands registered");
      } catch (err) {
        this.log(`[!] Failed to register commands: ${err.message}`);
      }
    });

    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName, options } = interaction;

      try {
        switch (commandName) {
          case "creatembot": {
            const name = options.getString("botname");
            const ok = this.botManager.createBot(name);
            const embed = new EmbedBuilder()
              .setColor(ok ? 0x2ecc71 : 0xe74c3c)
              .setTitle(ok ? "Bot Created" : "Error")
              .setDescription(
                ok
                  ? `Bot \`${name}\` created successfully.\nUse \`/mjoin ${name} <ip:port>\` to connect.`
                  : `Bot \`${name}\` already exists.`
              )
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
          }
          case "mjoin": {
            const name = options.getString("botname");
            const address = options.getString("address");
            let host = address;
            let port = "25565";
            if (address.includes(":")) {
              const parts = address.split(":");
              host = parts[0];
              port = parts[1];
            }
            const ok = this.botManager.joinServer(name, host, port);
            const embed = new EmbedBuilder()
              .setColor(ok ? 0x2ecc71 : 0xe74c3c)
              .setTitle(ok ? "Joining Server" : "Error")
              .setDescription(
                ok
                  ? `Bot \`${name}\` is connecting to ${host}:${port}...`
                  : `Failed to connect bot \`${name}\`. Check if it was created with \`/creatembot\`.`
              )
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
          }
          case "mleave": {
            const name = options.getString("botname");
            const ok = this.botManager.leaveServer(name);
            const embed = new EmbedBuilder()
              .setColor(ok ? 0xf39c12 : 0xe74c3c)
              .setTitle(ok ? "Disconnected" : "Error")
              .setDescription(
                ok
                  ? `Bot \`${name}\` has left the server.`
                  : `Bot \`${name}\` not found or not connected.`
              )
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
          }
          case "console": {
            const logs = this.consoleLogs.slice(-50);
            const text =
              logs.length > 0
                ? "```\n" + logs.join("\n").slice(-3900) + "\n```"
                : "No logs yet.";
            const embed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("Console Log")
              .setDescription(text)
              .setFooter({ text: `Last ${Math.min(logs.length, 50)} lines` })
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
          }
          case "mbots": {
            const bots = this.botManager.getBotsList();
            const names = Object.keys(bots);
            if (names.length === 0) {
              const embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle("Bots")
                .setDescription("No bots created. Use `/creatembot <name>` first.")
                .setTimestamp();
              await interaction.reply({ embeds: [embed] });
              return;
            }
            const desc = names
              .map((n) => {
                const b = bots[n];
                const statusEmoji =
                  b.status === "online"
                    ? "🟢"
                    : b.status === "connecting"
                    ? "🟡"
                    : "⚪";
                const server = b.host ? `\`${b.host}:${b.port}\`` : "N/A";
                return `${statusEmoji} **${n}** — ${b.status} ${server}`;
              })
              .join("\n");
            const embed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("Bot List")
              .setDescription(desc)
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            break;
          }
        }
      } catch (err) {
        this.log(`[!] Discord command error: ${err.message}`);
        try {
          await interaction.reply({
            content: `Error: ${err.message}`,
            ephemeral: true,
          });
        } catch (_) {}
      }
    });

    this.client.on("disconnect", () => {
      this.ready = false;
      this.onStatus(false);
    });

    this.client.login(this.token).catch((err) => {
      this.ready = false;
      this.onStatus(false);
      this.log(`[!] Discord login failed: ${err.message}`);
    });
  }

  stop() {
    this.ready = false;
    this.onStatus(false);
    this.client.destroy();
  }
}

module.exports = DiscordBot;

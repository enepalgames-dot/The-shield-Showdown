const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { REST, Routes } = require("discord.js");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MAX_GROUP = 40;
const uploadDir = path.join(__dirname, "uploads");
const scheduleFile = path.join(uploadDir, "schedule.png");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use("/uploads", express.static(uploadDir, {
  setHeaders: res => {
    res.set("Cache-Control", "no-store");
  }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, "schedule.png")
});

const upload = multer({ storage });

let roomData = {};
let checkins = {};

const groupChannels = {
  1: "1517781773008769134",
  2: "1517781774892142602",
  3: "1517781776209285220",
  4: "1517781777316315188",
  5: "1517781779057086505",
  6: "1517781781166952488",
  7: "1517781782022586400",
  8: "1517781784245436448",
  9: "1517781786812350494",
  10: "1517781788532015145",
  11: "1517781790675308554",
  12: "1517781791866490981",
  13: "1517781793192018080",
  14: "1517781794840121555",
  15: "1517781796446802071",
  16: "1517781798149427232",
  17: "1517781802947969145",
  18: "1517781805007376386",
  19: "1517781806764654592",
  20: "1517781808316420126",
  21: "1517781810040275025",
  22: "1517781813555363871",
  23: "1517781815836807259",
  24: "1517781817414123600",
  25: "1517781818617892973",
  26: "1517781820471513108",
  27: "1517781822233120778",
  28: "1517781823718162442",
  29: "1517781824976191680",
  30: "1517781827039793163",
  31: "1517781828407263242",
  32: "1517781829992583269",
  33: "1517781831997456506",
  34: "1517781833658662913",
  35: "1517781835977982093",
  36: "1517781837680869407",
  37: "1517781839673294929",
  38: "1518240408977670169",
  39: process.env.GROUP_39_CHANNEL_ID,
  40: process.env.GROUP_40_CHANNEL_ID
};

const rest = new REST({ version: "10" });

function configureDiscordRest() {
  if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is not set.");
  }

  rest.setToken(process.env.BOT_TOKEN);
  return rest;
}

function isValidGroup(group) {
  return Number.isInteger(group) && group >= 1 && group <= MAX_GROUP;
}

function getMessageText(message) {
  let text = message.content || "";

  if (message.embeds?.length) {
    message.embeds.forEach(embed => {
      text += "\n" + (embed.title || "");
      text += "\n" + (embed.description || "");

      embed.fields?.forEach(field => {
        text += "\n" + (field.name || "");
        text += "\n" + (field.value || "");
      });

      text += "\n" + (embed.footer?.text || "");
    });
  }

  return text;
}

function parseGroups(text) {
  const groupRegex = /group\s*(\d+)\s*(list)?/gi;
  const matches = [...text.matchAll(groupRegex)];

  if (!matches.length) return [];

  const groups = [];

  for (let i = 0; i < matches.length; i++) {
    const groupNumber = Number(matches[i][1]);

    if (!isValidGroup(groupNumber)) continue;

    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.slice(start, end);

    const teams = [];
    const slotRegex = /slot\s*0?(\d+)\s*[-=->:]*\s*(team\s*)?([^\n]+)/gi;

    let match;

    while ((match = slotRegex.exec(block)) !== null) {
      let teamName = match[3]
        .replace(/[>`*]/g, "")
        .replace(/^team\s+/i, "")
        .trim();

      if (
        teamName &&
        !teamName.toLowerCase().startsWith("slot") &&
        !teamName.toLowerCase().includes("jhuse esports")
      ) {
        teams.push(teamName);
      }
    }

    groups.push({
      name: `GROUP ${groupNumber}`,
      group: groupNumber,
      teams: teams.slice(0, 12)
    });
  }

  return groups.sort((a, b) => a.group - b.group);
}

async function loadDiscordGroups() {
  if (!process.env.CHANNEL_ID) {
    throw new Error("CHANNEL_ID is not set.");
  }

  const messages = await configureDiscordRest().get(
    Routes.channelMessages(process.env.CHANNEL_ID),
    { query: new URLSearchParams({ limit: "100" }) }
  );

  const text = messages
    .map(getMessageText)
    .reverse()
    .join("\n");

  return parseGroups(text);
}

function getGroupChannelId(group) {
  const channelId = groupChannels[group];

  if (!channelId) {
    throw new Error(`Channel ID not set for Group ${group}`);
  }

  return channelId;
}

async function sendDiscordMessage(channelId, content) {
  await configureDiscordRest().post(Routes.channelMessages(channelId), {
    body: { content }
  });
}

async function sendRoomToDiscord(group, roomId, password) {
  await sendDiscordMessage(
    getGroupChannelId(group),
`**ROOM DETAILS - GROUP ${group}**

**Room ID:** ${roomId}
**Password:** ${password}

Join on time.
Do not share this outside your group.`
  );
}

async function sendCheckinToDiscord(group, teamName) {
  await sendDiscordMessage(
    getGroupChannelId(group),
`**CHECK-IN CONFIRMED**

Group: ${group}
Team: **${teamName}**`
  );
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/checkin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "checkin.html"));
});

app.get("/groups.html", (req, res) => {
  res.sendFile(path.join(__dirname, "groups.html"));
});

app.get("/roadmap", (req, res) => {
  res.sendFile(path.join(__dirname, "roadmap.html"));
});

app.get("/checkin", (req, res) => {
  res.sendFile(path.join(__dirname, "checkin.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/schedule.html", (req, res) => {
  res.sendFile(path.join(__dirname, "schedule.html"));
});

app.get(["/schdule", "/schdule.html"], (req, res) => {
  res.redirect(301, "/schedule.html");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/groups", async (req, res) => {
  try {
    const groups = await loadDiscordGroups();
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Cannot load Discord groups."
    });
  }
});

app.post("/upload-schedule", upload.single("schedule"), (req, res) => {
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY is not set." });
  }

  if (req.body.adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      error: "Invalid admin key"
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: "Schedule image is required."
    });
  }

  res.json({
    success: true,
    message: "Schedule uploaded successfully."
  });
});

app.post("/delete-schedule", (req, res) => {
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY is not set." });
  }

  if (req.body.adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      error: "Invalid admin key"
    });
  }

  if (fs.existsSync(scheduleFile)) {
    fs.unlinkSync(scheduleFile);
  }

  res.json({
    success: true,
    message: "Schedule deleted successfully."
  });
});

app.post("/send-room", async (req, res) => {
  try {
    const { adminKey, group, roomId, password } = req.body;
    const groupNumber = Number(group);

    if (!process.env.ADMIN_KEY) {
      return res.status(500).json({ error: "ADMIN_KEY is not set." });
    }

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Invalid admin key" });
    }

    if (!isValidGroup(groupNumber)) {
      return res.status(400).json({
        error: `Group must be between 1 and ${MAX_GROUP}.`
      });
    }

    if (!roomId || !password) {
      return res.status(400).json({
        error: "Room ID and Password are required."
      });
    }

    roomData[groupNumber] = {
      roomId: String(roomId).trim(),
      password: String(password).trim(),
      updatedAt: new Date().toLocaleString()
    };

    await sendRoomToDiscord(
      groupNumber,
      roomData[groupNumber].roomId,
      roomData[groupNumber].password
    );

    res.json({
      success: true,
      message: `Room ID and password sent to Group ${groupNumber}.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Failed to send room details."
    });
  }
});

app.get("/room/:group", (req, res) => {
  const group = Number(req.params.group);

  if (!isValidGroup(group)) {
    return res.status(400).json({
      error: `Group must be between 1 and ${MAX_GROUP}.`
    });
  }

  res.json(roomData[group] || null);
});

app.post("/checkin", async (req, res) => {
  try {
    const { group, teamName } = req.body;
    const groupNumber = Number(group);

    if (!isValidGroup(groupNumber)) {
      return res.status(400).json({
        error: `Group must be between 1 and ${MAX_GROUP}.`
      });
    }

    if (!teamName || !String(teamName).trim()) {
      return res.status(400).json({
        error: "Team name is required."
      });
    }

    const cleanTeamName = String(teamName).trim();

    if (!checkins[groupNumber]) {
      checkins[groupNumber] = [];
    }

    const alreadyChecked = checkins[groupNumber].some(
      team => team.toLowerCase() === cleanTeamName.toLowerCase()
    );

    if (alreadyChecked) {
      return res.json({
        success: true,
        message: "Already checked in."
      });
    }

    checkins[groupNumber].push(cleanTeamName);

    await sendCheckinToDiscord(groupNumber, cleanTeamName);

    res.json({
      success: true,
      message: "Check-in successful."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || "Check-in failed."
    });
  }
});

app.get("/checkins/:group", (req, res) => {
  const group = Number(req.params.group);

  if (!isValidGroup(group)) {
    return res.status(400).json({
      error: `Group must be between 1 and ${MAX_GROUP}.`
    });
  }

  res.json(checkins[group] || []);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API: http://localhost:${PORT}/groups`);
    console.log(`Admin: http://localhost:${PORT}/admin.html`);
    console.log(`Check-In: http://localhost:${PORT}/checkin.html`);
  });
}

module.exports = app;

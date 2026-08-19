import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cors from "cors";
dotenv.config();
const app = express();
app.use(express.json({ limit: "10kb" }));

// Cache simple en memoria para no saturar las APIs externas
let downloadsCache = { data: null, timestamp: 0 };
let languagesCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

async function fetchModrinthDownloads() {
  const resp = await fetch("https://api.modrinth.com/v2/project/raft-world");
  if (!resp.ok) throw new Error(`Modrinth respondió ${resp.status}`);
  const data = await resp.json();
  return data.downloads ?? 0;
}

async function fetchCurseForgeDownloads() {
  const resp = await fetch(
    `https://api.curseforge.com/v1/mods/${process.env.CURSEFORGE_MOD_ID}`,
    {
      headers: { "x-api-key": process.env.CURSEFORGE_API_KEY },
    },
  );
  if (!resp.ok) throw new Error(`CurseForge respondió ${resp.status}`);
  const data = await resp.json();
  return data.data?.downloadCount ?? 0;
}

async function fetchCrowdinLanguages() {
  const resp = await fetch(
    `https://api.crowdin.com/api/v2/projects/${process.env.CROWDIN_PROJECT_ID}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CROWDIN_API_TOKEN}`,
      },
    },
  );
  if (!resp.ok) throw new Error(`Crowdin respondió ${resp.status}`);
  const data = await resp.json();
  return data.data?.targetLanguages?.length ?? 0;
}

// Solo aceptar peticiones desde tu propia web
app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));

// Límite: máx 5 envíos cada 10 minutos por IP
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: "Demasiadas peticiones, inténtalo más tarde." },
});

app.get("/api/downloads", async (req, res) => {
  const now = Date.now();
  if (downloadsCache.data && now - downloadsCache.timestamp < CACHE_TTL_MS) {
    return res.json(downloadsCache.data);
  }
  try {
    const [modrinth, curseforge] = await Promise.all([
      fetchModrinthDownloads().catch(() => null),
      fetchCurseForgeDownloads().catch(() => null),
    ]);
    const data = { modrinth, curseforge };
    downloadsCache = { data, timestamp: now };
    res.json(data);
  } catch (err) {
    console.error("Error obteniendo descargas:", err.message);
    res.status(502).json({ error: "No se pudieron obtener las descargas" });
  }
});

app.post("/api/ideas", limiter, async (req, res) => {
  const { author, contact, text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Texto vacío" });
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: "Texto demasiado largo" });
  }

  const safeAuthor = (author || "Anónimo").toString().slice(0, 50);
  const safeText = text.toString().slice(0, 1000);
  const safeContact = (contact || "").toString().slice(0, 100);

  try {
    const discordResp = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "💡 Nueva idea para Raft World",
            description: safeText,
            color: 0xf0c27a,
            fields: [
              { name: "De", value: safeAuthor, inline: true },
              {
                name: "Contacto",
                value: safeContact || "No proporcionado",
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!discordResp.ok) {
      throw new Error(`Discord respondió ${discordResp.status}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando a Discord:", err.message);
    res.status(502).json({ error: "No se pudo enviar" });
  }
});

app.get("/api/languages", async (req, res) => {
  const now = Date.now();
  if (languagesCache.data && now - languagesCache.timestamp < CACHE_TTL_MS) {
    return res.json(languagesCache.data);
  }
  try {
    const crowdin = await fetchCrowdinLanguages();
    const data = { crowdin };
    languagesCache = { data, timestamp: now };
    res.json(data);
  } catch (err) {
    console.error("Error obteniendo idiomas:", err.message);
    res.status(502).json({ error: "No se pudieron obtener los idiomas" });
  }
});

async function updateStatsJsonOnGithub(newContentObj) {
  const {
    GITHUB_TOKEN,
    GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME,
    GITHUB_STATS_PATH,
    GITHUB_BRANCH,
  } = process.env;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_STATS_PATH}`;

  const getResp = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
  });
  if (!getResp.ok)
    throw new Error(`No se pudo leer stats.json (${getResp.status})`);
  const getData = await getResp.json();
  const sha = getData.sha;

  const contentBase64 = Buffer.from(
    JSON.stringify(newContentObj, null, 2),
  ).toString("base64");

  const putResp = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "chore: actualizar stats.json automáticamente",
      content: contentBase64,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });
  if (!putResp.ok) {
    const errBody = await putResp.text();
    throw new Error(
      `No se pudo escribir stats.json (${putResp.status}): ${errBody}`,
    );
  }
}

app.get("/api/refresh-stats", async (req, res) => {
  const now = Date.now();
  const downloadsStale =
    !downloadsCache.data || now - downloadsCache.timestamp >= CACHE_TTL_MS;
  const languagesStale =
    !languagesCache.data || now - languagesCache.timestamp >= CACHE_TTL_MS;

  if (!downloadsStale && !languagesStale) {
    return res.json({ updated: false });
  }

  try {
    const [modrinth, curseforge, crowdin] = await Promise.all([
      fetchModrinthDownloads().catch(() => null),
      fetchCurseForgeDownloads().catch(() => null),
      fetchCrowdinLanguages().catch(() => null),
    ]);

    downloadsCache = { data: { modrinth, curseforge }, timestamp: now };
    languagesCache = { data: { crowdin }, timestamp: now };

    await updateStatsJsonOnGithub({
      downloads: { curseforge: curseforge ?? 0, modrinth: modrinth ?? 0 },
      languages: { crowdin: crowdin ?? 0 },
      updatedAt: new Date().toISOString(),
    });

    res.json({ updated: true });
  } catch (err) {
    console.error("Error actualizando stats.json:", err.message);
    res.status(502).json({ error: "No se pudo actualizar stats.json" });
  }
});

const port = process.env.PORT || 4750;
app.listen(port, () => {
  console.log(`Backend de ideas escuchando en el puerto ${port}`);
});

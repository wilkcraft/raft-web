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
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin) return next();

  if (origin !== process.env.ALLOWED_ORIGIN) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  next();
});

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

const port = process.env.PORT || 4750;
app.listen(port, () => {
  console.log(`Backend de ideas escuchando en el puerto ${port}`);
});

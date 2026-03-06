import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";
const scoresTable = process.env.SUPABASE_SCORES_TABLE ?? "scores";

type Score = {
  initials: string;
  score: number;
  run_seconds: number;
  seed: string | null;
  created_at: string;
};

const scoreSubmissionSchema = z.object({
  initials: z.string().trim().min(1).max(3),
  score: z.number().int().min(0).max(1_000_000_000),
  runSeconds: z.number().finite().min(0).max(86_400).default(0),
  seed: z.string().trim().max(40).optional(),
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

const localScores: Score[] = [];

app.use(
  cors({
    origin: clientOrigin === "*" ? true : clientOrigin,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, supabaseConfigured: Boolean(supabase) });
});

app.get("/leaderboard", async (req, res) => {
  const requestedLimit = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(25, Math.floor(requestedLimit)))
    : 10;

  if (!supabase) {
    const leaderboard = [...localScores]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.run_seconds !== b.run_seconds) return a.run_seconds - b.run_seconds;
        return a.created_at.localeCompare(b.created_at);
      })
      .slice(0, limit);

    return res.json({ entries: leaderboard });
  }

  const { data, error } = await supabase
    .from(scoresTable)
    .select("initials, score, run_seconds, seed, created_at")
    .order("score", { ascending: false })
    .order("run_seconds", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: "Failed to fetch leaderboard." });
  }

  return res.json({ entries: (data ?? []) as Score[] });
});

app.post("/submit-score", async (req, res) => {
  const parsed = scoreSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload." });
  }

  const initials = parsed.data.initials.toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(initials)) {
    return res
      .status(400)
      .json({ error: "Initials must be exactly 3 alphanumeric characters." });
  }

  const entry: Score = {
    initials,
    score: parsed.data.score,
    run_seconds: parsed.data.runSeconds,
    seed: parsed.data.seed ?? null,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    localScores.push(entry);
    return res.status(201).json({ entry });
  }

  const { data, error } = await supabase
    .from(scoresTable)
    .insert({
      initials: entry.initials,
      score: entry.score,
      run_seconds: entry.run_seconds,
      seed: entry.seed,
    })
    .select("initials, score, run_seconds, seed, created_at")
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to submit score." });
  }

  return res.status(201).json({ entry: data });
});

app.listen(port, () => {
  // Keep startup log concise and deployment-safe.
  console.log(
    `Mars Minitaxi API listening on :${port} | supabase=${supabase ? "on" : "off"}`,
  );
});

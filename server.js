import express from 'express';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- config (원하면 이 부분만 수정) -----
const JUDGES = [
  { id: 'music',    name: '음악전문가',   weight: 0.40 },
  { id: 'youth',    name: '청소년전문가', weight: 0.35 },
  { id: 'musician', name: '청소년음악가', weight: 0.25 }
];
const CRITERIA = [
  { id: 'stage',      name: '무대장악력', max: 40 },
  { id: 'skill',      name: '실력',       max: 30 },
  { id: 'creativity', name: '창의성',     max: 30 }
];
const DEFAULT_TEAMS = ['온새미','인포드','이다희','노루바나','금정유소년타악오케스트라','체리핫식스','통제구역','케이사','디텐','박선우밴드'];
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

// ----- Turso / libSQL client (없으면 로컬 파일로 동작) -----
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function init() {
  await db.execute(`CREATE TABLE IF NOT EXISTS scores(
    judge TEXT NOT NULL,
    team_idx INTEGER NOT NULL,
    stage INTEGER DEFAULT 0,
    skill INTEGER DEFAULT 0,
    creativity INTEGER DEFAULT 0,
    updated_at INTEGER,
    PRIMARY KEY (judge, team_idx)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY, value TEXT
  )`);
  const r = await db.execute(`SELECT value FROM settings WHERE key='teams'`);
  if (r.rows.length === 0) {
    await db.execute({ sql: `INSERT INTO settings(key,value) VALUES('teams',?)`, args: [JSON.stringify(DEFAULT_TEAMS)] });
  }
}

async function getTeams() {
  const r = await db.execute(`SELECT value FROM settings WHERE key='teams'`);
  try { return r.rows.length ? JSON.parse(r.rows[0].value) : DEFAULT_TEAMS; }
  catch { return DEFAULT_TEAMS; }
}

const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(+v || 0)));

// ----- API -----
app.get('/api/state', async (req, res) => {
  try {
    const teams = await getTeams();
    const r = await db.execute(`SELECT judge, team_idx, stage, skill, creativity FROM scores`);
    res.json({ teams, judges: JUDGES, criteria: CRITERIA, scores: r.rows });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/score', async (req, res) => {
  try {
    const { judge, teamIdx, stage, skill, creativity } = req.body || {};
    if (!JUDGES.find(j => j.id === judge)) return res.status(400).json({ error: 'bad judge' });
    const ti = +teamIdx;
    await db.execute({
      sql: `INSERT INTO scores(judge,team_idx,stage,skill,creativity,updated_at)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(judge,team_idx) DO UPDATE SET
              stage=excluded.stage, skill=excluded.skill,
              creativity=excluded.creativity, updated_at=excluded.updated_at`,
      args: [judge, ti, clamp(stage, 40), clamp(skill, 30), clamp(creativity, 30), Date.now()]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

async function getPin() {
  try {
    const r = await db.execute(`SELECT value FROM settings WHERE key='admin_pin'`);
    if (r.rows.length && r.rows[0].value) return r.rows[0].value;
  } catch {}
  return ADMIN_PIN;
}

app.post('/api/admin/check', async (req, res) => res.json({ ok: (req.body?.pin) === await getPin() }));

app.post('/api/admin/pin', async (req, res) => {
  try {
    if ((req.body?.pin) !== await getPin()) return res.status(403).json({ error: 'pin' });
    const np = String(req.body?.newPin || '').trim();
    if (np.length < 4 || np.length > 20) return res.status(400).json({ error: 'length' });
    await db.execute({ sql: `INSERT INTO settings(key,value) VALUES('admin_pin',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`, args: [np] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/teams', async (req, res) => {
  try {
    if ((req.body?.pin) !== await getPin()) return res.status(403).json({ error: 'pin' });
    const teams = req.body.teams;
    if (!Array.isArray(teams) || !teams.length) return res.status(400).json({ error: 'bad teams' });
    await db.execute({ sql: `INSERT INTO settings(key,value) VALUES('teams',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`, args: [JSON.stringify(teams)] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/reset', async (req, res) => {
  try {
    if ((req.body?.pin) !== await getPin()) return res.status(403).json({ error: 'pin' });
    await db.execute(`DELETE FROM scores`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
init().then(() => app.listen(PORT, () => console.log('▶ listening on ' + PORT)))
      .catch(e => { console.error('init failed', e); process.exit(1); });

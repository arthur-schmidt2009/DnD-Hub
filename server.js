const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
 
const app = express();
app.use(express.json());
app.use(express.static('.'));
 
// ─── IN-MEMORY STORAGE ───────────────────────────────────────────────────────
const users = {};       // { userId: userObject }
const sessions = {};    // { sessionId: userId }
const characters = {};  // { characterId: characterObject }
const campaigns = {};   // { campaignId: campaignObject }
const encounters = {};  // { encounterId: encounterObject }
 
// ─── HELPERS ─────────────────────────────────────────────────────────────────
const DM_PASSWORD = 'IchLiebeMichSelbst123';
 
function getModifier(score) {
  return Math.floor((score - 10) / 2);
}
 
function authMiddleware(req, res, next) {
  const sessionId = req.headers['authorization'];
  if (!sessionId || !sessions[sessionId]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = sessions[sessionId];
  req.user = users[userId];
  next();
}
 
function dmMiddleware(req, res, next) {
  if (req.user.role !== 'dm') {
    return res.status(403).json({ error: 'DM access required' });
  }
  next();
}
 
function createDefaultCharacter(userId) {
  return {
    id: uuidv4(),
    userId,
    identity: {
      name: 'New Hero',
      class: '',
      level: 1,
      background: '',
      playerName: '',
      race: '',
      alignment: '',
      experience: 0
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    },
    savingThrows: {
      strength: false,
      dexterity: false,
      constitution: false,
      intelligence: false,
      wisdom: false,
      charisma: false
    },
    combat: {
      armorClass: 10,
      initiative: 0,
      speed: 30,
      hpCurrent: 10,
      hpMax: 10,
      hpTemp: 0,
      hitDice: '1d8',
      deathSaves: { success: 0, fail: 0 }
    },
    skills: {
      acrobatics: false,
      animalHandling: false,
      arcana: false,
      athletics: false,
      deception: false,
      history: false,
      insight: false,
      intimidation: false,
      investigation: false,
      medicine: false,
      nature: false,
      perception: false,
      performance: false,
      persuasion: false,
      religion: false,
      sleightOfHand: false,
      stealth: false,
      survival: false
    },
    equipment: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, inventory: [] },
    personality: { traits: '', ideals: '', bonds: '', flaws: '' },
    features: { classFeatures: [], racialTraits: [], passivePerception: 10 },
    spells: {
      spellSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      knownSpells: [],
      preparedSpells: [],
      spellSaveDC: 8,
      spellAttackBonus: 0
    },
    lore: {
      backstory: '',
      appearance: { eyes: '', skin: '', hair: '', height: '', weight: '' },
      allies: '',
      notes: ''
    },
    createdAt: new Date().toISOString()
  };
}
 
// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
 
  // Find or create user
  let user = Object.values(users).find(u => u.username === username);
 
  if (!user) {
    // Auto-create
    const role = password === DM_PASSWORD ? 'dm' : 'player';
    user = {
      id: uuidv4(),
      username,
      password,
      role,
      createdAt: new Date().toISOString()
    };
    users[user.id] = user;
  } else {
    // Validate password
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
  }
 
  const sessionId = uuidv4();
  sessions[sessionId] = user.id;
 
  res.json({
    sessionId,
    user: { id: user.id, username: user.username, role: user.role }
  });
});
 
app.get('/auth/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id: u.id, username: u.username, role: u.role });
});
 
app.post('/auth/logout', authMiddleware, (req, res) => {
  const sessionId = req.headers['authorization'];
  delete sessions[sessionId];
  res.json({ success: true });
});
 
// ─── CHARACTER ROUTES ─────────────────────────────────────────────────────────
app.post('/characters', authMiddleware, (req, res) => {
  const char = createDefaultCharacter(req.user.id);
  if (req.body && req.body.name) char.identity.name = req.body.name;
  characters[char.id] = char;
  res.status(201).json(char);
});
 
app.get('/characters', authMiddleware, (req, res) => {
  if (req.user.role === 'dm') {
    return res.json(Object.values(characters));
  }
  const myChars = Object.values(characters).filter(c => c.userId === req.user.id);
  res.json(myChars);
});
 
app.get('/characters/:id', authMiddleware, (req, res) => {
  const char = characters[req.params.id];
  if (!char) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'dm' && char.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(char);
});
 
app.put('/characters/:id', authMiddleware, (req, res) => {
  const char = characters[req.params.id];
  if (!char) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'dm' && char.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
 
  // Deep merge update
  const updated = deepMerge(char, req.body);
  updated.id = char.id;
  updated.userId = char.userId;
  updated.createdAt = char.createdAt;
  characters[char.id] = updated;
  res.json(updated);
});
 
app.delete('/characters/:id', authMiddleware, dmMiddleware, (req, res) => {
  if (!characters[req.params.id]) return res.status(404).json({ error: 'Not found' });
  delete characters[req.params.id];
  res.json({ success: true });
});
 
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
 
// ─── CAMPAIGN ROUTES ──────────────────────────────────────────────────────────
app.post('/campaigns', authMiddleware, dmMiddleware, (req, res) => {
  const { name, description } = req.body;
  const campaign = {
    id: uuidv4(),
    name: name || 'New Campaign',
    description: description || '',
    dmId: req.user.id,
    players: [],
    characters: [],
    createdAt: new Date().toISOString()
  };
  campaigns[campaign.id] = campaign;
  res.status(201).json(campaign);
});
 
app.get('/campaigns', authMiddleware, (req, res) => {
  if (req.user.role === 'dm') {
    return res.json(Object.values(campaigns));
  }
  const myCampaigns = Object.values(campaigns).filter(c =>
    c.players.includes(req.user.id)
  );
  res.json(myCampaigns);
});
 
app.get('/campaigns/:id', authMiddleware, (req, res) => {
  const c = campaigns[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});
 
app.put('/campaigns/:id', authMiddleware, dmMiddleware, (req, res) => {
  const c = campaigns[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  Object.assign(c, req.body, { id: c.id, dmId: c.dmId });
  res.json(c);
});
 
app.post('/campaigns/:id/players', authMiddleware, dmMiddleware, (req, res) => {
  const c = campaigns[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { userId, characterId } = req.body;
  if (userId && !c.players.includes(userId)) c.players.push(userId);
  if (characterId && !c.characters.includes(characterId)) c.characters.push(characterId);
  res.json(c);
});
 
// ─── ENCOUNTER / COMBAT ROUTES ────────────────────────────────────────────────
app.post('/encounters', authMiddleware, dmMiddleware, (req, res) => {
  const { campaignId, participants } = req.body;
  const encounter = {
    id: uuidv4(),
    campaignId: campaignId || null,
    participants: (participants || []).map(p => ({
      id: p.id || uuidv4(),
      name: p.name,
      type: p.type || 'player', // player | npc | monster
      hp: p.hp || 10,
      hpMax: p.hpMax || p.hp || 10,
      initiative: 0,
      dexMod: p.dexMod || 0,
      characterId: p.characterId || null
    })),
    initiativeOrder: [],
    currentTurnIndex: 0,
    round: 1,
    status: 'setup', // setup | active | ended
    log: [],
    createdAt: new Date().toISOString()
  };
  encounters[encounter.id] = encounter;
  res.status(201).json(encounter);
});
 
app.get('/encounters/:id', authMiddleware, (req, res) => {
  const enc = encounters[req.params.id];
  if (!enc) return res.status(404).json({ error: 'Not found' });
  res.json(enc);
});
 
app.get('/encounters', authMiddleware, dmMiddleware, (req, res) => {
  res.json(Object.values(encounters));
});
 
app.post('/encounters/:id/roll-initiative', authMiddleware, dmMiddleware, (req, res) => {
  const enc = encounters[req.params.id];
  if (!enc) return res.status(404).json({ error: 'Not found' });
 
  enc.participants.forEach(p => {
    const roll = Math.floor(Math.random() * 20) + 1;
    p.initiative = roll + (p.dexMod || 0);
  });
 
  enc.initiativeOrder = [...enc.participants]
    .sort((a, b) => b.initiative - a.initiative)
    .map(p => p.id);
 
  enc.currentTurnIndex = 0;
  enc.round = 1;
  enc.status = 'active';
  enc.log.push({
    type: 'system',
    message: 'Initiative rolled! Combat begins!',
    timestamp: new Date().toISOString()
  });
 
  res.json(enc);
});
 
app.post('/encounters/:id/action', authMiddleware, (req, res) => {
  const enc = encounters[req.params.id];
  if (!enc) return res.status(404).json({ error: 'Not found' });
  if (enc.status !== 'active') return res.status(400).json({ error: 'Encounter not active' });
 
  const { actionType, actorId, targetId, value } = req.body;
  const actor = enc.participants.find(p => p.id === actorId);
  const target = targetId ? enc.participants.find(p => p.id === targetId) : null;
 
  if (!actor) return res.status(400).json({ error: 'Actor not found' });
 
  let logMessage = '';
  let result = {};
 
  switch (actionType) {
    case 'attack': {
      const roll = Math.floor(Math.random() * 20) + 1;
      const attackBonus = value || 0;
      const total = roll + attackBonus;
      const hit = roll === 20 || total >= (target ? 10 : 10);
      logMessage = `${actor.name} attacks ${target ? target.name : 'target'}: d20(${roll})+${attackBonus}=${total} — ${hit ? 'HIT!' : 'MISS'}`;
      result = { roll, total, hit, critical: roll === 20 };
      break;
    }
    case 'damage': {
      if (target) {
        const dmg = value || Math.floor(Math.random() * 8) + 1;
        target.hp = Math.max(0, target.hp - dmg);
        logMessage = `${actor.name} deals ${dmg} damage to ${target.name}. HP: ${target.hp}/${target.hpMax}`;
        result = { damage: dmg, targetHp: target.hp };
        if (target.hp === 0) {
          logMessage += ` — ${target.name} is DOWN!`;
        }
      }
      break;
    }
    case 'heal': {
      const tgt = target || actor;
      const healAmt = value || Math.floor(Math.random() * 8) + 1;
      tgt.hp = Math.min(tgt.hpMax, tgt.hp + healAmt);
      logMessage = `${actor.name} heals ${tgt.name} for ${healAmt}. HP: ${tgt.hp}/${tgt.hpMax}`;
      result = { healed: healAmt, targetHp: tgt.hp };
      break;
    }
    case 'end_turn': {
      enc.currentTurnIndex = (enc.currentTurnIndex + 1) % enc.initiativeOrder.length;
      if (enc.currentTurnIndex === 0) enc.round++;
      const nextId = enc.initiativeOrder[enc.currentTurnIndex];
      const next = enc.participants.find(p => p.id === nextId);
      logMessage = `${actor.name} ends turn. Round ${enc.round} — ${next ? next.name : '?'}'s turn`;
      result = { nextTurn: nextId, round: enc.round };
      break;
    }
    case 'custom': {
      logMessage = `${actor.name}: ${value}`;
      result = { custom: value };
      break;
    }
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
 
  const logEntry = {
    id: uuidv4(),
    actorId,
    targetId: targetId || null,
    actionType,
    value,
    result,
    message: logMessage,
    timestamp: new Date().toISOString()
  };
 
  enc.log.push(logEntry);
  res.json({ encounter: enc, logEntry });
});
 
app.post('/encounters/:id/end', authMiddleware, dmMiddleware, (req, res) => {
  const enc = encounters[req.params.id];
  if (!enc) return res.status(404).json({ error: 'Not found' });
  enc.status = 'ended';
  enc.log.push({ type: 'system', message: 'Encounter ended.', timestamp: new Date().toISOString() });
  res.json(enc);
});
 
// ─── DM ROUTES ────────────────────────────────────────────────────────────────
app.get('/dm/users', authMiddleware, dmMiddleware, (req, res) => {
  res.json(Object.values(users).map(u => ({
    id: u.id, username: u.username, role: u.role, createdAt: u.createdAt
  })));
});
 
app.put('/dm/users/:id/role', authMiddleware, dmMiddleware, (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (['player', 'dm'].includes(req.body.role)) {
    user.role = req.body.role;
  }
  res.json({ id: user.id, username: user.username, role: user.role });
});
 
// ─── SERVE FRONTEND ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚔️  D&D 5e Server running on http://localhost:${PORT}`);
  console.log(`🎲 DM Password: ${DM_PASSWORD}`);
});

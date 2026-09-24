import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types & Interfaces
// ============================================================================
export type ReactionEmoji = '❤️' | '😂' | '🔥' | '😢' | '🥹';

export interface DbUser {
  id: string;
  token: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string;
  currentPairId: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export interface DbPair {
  id: string;
  inviteCode: string;
  userAId: string;
  userBId: string | null;
  startDate: string;
  createdAt: string;
  isLovely: boolean;
  lovelyPurchasedAt?: string;
  subscription: 'free' | 'premium';
  status: 'pending' | 'active';
}

export interface DbMomentPhoto {
  userId: string;
  imageUrl: string;
  createdAt: string;
}

export interface DbMoment {
  id: string;
  pairId: string;
  dateKey: string;
  order: 1 | 2 | 3;
  label: string;
  prompt: string;
  subtext: string;
  themeColor: 'peach' | 'pink' | 'blue';
  photos: DbMomentPhoto[];
  reactions: Record<string, ReactionEmoji>;
  revealed: boolean;
  status: 'EMPTY' | 'USER_UPLOADED' | 'BOTH_UPLOADED' | 'MATCH' | 'REVEALED' | 'REACTED' | 'COMPLETED';
  completedAt?: string;
  completedTimestamp?: number;
  createdAt: string;
}

export interface DbHistoryDay {
  id: string;
  pairId: string;
  dateKey: string;
  title: string;
  subtitle: string;
  dateStr: string;
  moments: DbMoment[];
  isLocked: boolean;
}

export interface DatabaseStore {
  users: Record<string, DbUser>; // keyed by user.id
  tokens: Record<string, string>; // token -> user.id
  pairs: Record<string, DbPair>; // keyed by pair.id
  pairsByInviteCode: Record<string, string>; // inviteCode (uppercase) -> pair.id
  moments: Record<string, DbMoment[]>; // pairId -> array of moments
  history: Record<string, DbHistoryDay[]>; // pairId -> array of history days
}

// ============================================================================
// In-Memory & File Store with Persistence
// ============================================================================
const DATA_DIR = path.resolve(__dirname, '.data');
const DATA_FILE = path.resolve(DATA_DIR, 'ours-store.json');

const db: DatabaseStore = {
  users: {},
  tokens: {},
  pairs: {},
  pairsByInviteCode: {},
  moments: {},
  history: {},
};

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        db.users = parsed.users || {};
        db.tokens = parsed.tokens || {};
        db.pairs = parsed.pairs || {};
        db.pairsByInviteCode = parsed.pairsByInviteCode || {};
        db.moments = parsed.moments || {};
        db.history = parsed.history || {};
        console.log(`[OURS DB] Loaded ${Object.keys(db.users).length} users, ${Object.keys(db.pairs).length} pairs from disk.`);
      }
    }
  } catch (err) {
    console.error('[OURS DB] Error loading database from disk:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function persistDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('[OURS DB] Error persisting database to disk:', err);
    }
  }, 100);
}

loadDatabase();

// ============================================================================
// Utilities & Helpers
// ============================================================================
function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rnd}`;
}

function generateToken(): string {
  return `tok_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 12)}`;
}

function generateInviteCode(): string {
  // Generates OURS-XXXX (4 digits)
  for (let i = 0; i < 100; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = `OURS-${num}`;
    if (!db.pairsByInviteCode[code]) {
      return code;
    }
  }
  return `OURS-${Math.floor(10000 + Math.random() * 90000)}`;
}

function getLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRussianDate(date: Date = new Date()): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const AVATAR_PALETTE = ['#F6DCE1', '#DDEAF7', '#FAF2EE', '#F6F0F7', '#FAF6EC'];
function getRandomAvatarColor(): string {
  return AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
}

const DAILY_PROMPTS_POOL: Array<{
  prompt: string;
  subtext: string;
  themeColor: 'peach' | 'pink' | 'blue';
}> = [
  {
    prompt: 'Покажи, что сейчас рядом с тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что сейчас перед твоими глазами?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи маленькую часть своего дня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Что сегодня вызвало у тебя улыбку?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Покажи место, где ты прямо сейчас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Твой любимый вид или ракурс сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Что сейчас у тебя в руках или на столе?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Покажи кусочек неба над тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Что прямо сейчас создаёт твоё настроение?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи то, на что тебе приятно смотреть',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Чашка кофе, чай или твой перерыв',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Твоя тень или солнечный луч рядом',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'То, что напомнило тебе обо мне сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что окружает тебя прямо сейчас?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Твоя дорога или вид из окна',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Маленькая деталь, которую никто не заметил',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Твой уютный уголок сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что ты видишь, если поднимешь взгляд?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Твой любимый предмет прямо сейчас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Как выглядит твой текущий момент?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи то, что согревает тебя сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'То, что лежит перед тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Твоё пространство в эту минуту',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Маленькая радость сегодняшнего дня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что-то красивое, попавшееся на пути',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Снимок прямо сейчас — без подготовки',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что хочется сохранить в памяти сегодня?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Оставь кусочек своего дня для нас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Покажи свой сегодняшний момент',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что хочется разделить со мной прямо сейчас?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  }
];

function getPromptForPairMoment(pairId: string, dateKey: string, order: 1 | 2 | 3) {
  let hash = 0;
  const seed = `${pairId || 'ours'}_${dateKey || 'today'}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const baseIndex = Math.abs(hash);
  const promptIdx = (baseIndex + (order - 1) * 7) % DAILY_PROMPTS_POOL.length;
  return DAILY_PROMPTS_POOL[promptIdx];
}

function createDefaultMomentsForPair(pairId: string, dateKey: string = getLocalDateKey()): DbMoment[] {
  return ([1, 2, 3] as const).map((order) => {
    const promptData = getPromptForPairMoment(pairId, dateKey, order);
    return {
      id: `mom_${pairId}_${dateKey}_${order}`,
      pairId,
      dateKey,
      order,
      label: `МОМЕНТ ${order}`,
      prompt: promptData.prompt,
      subtext: promptData.subtext,
      themeColor: promptData.themeColor,
      photos: [],
      reactions: {},
      revealed: false,
      status: 'EMPTY' as const,
      createdAt: new Date().toISOString(),
    };
  });
}

function formatMomentClientView(moment: DbMoment, currentUserId: string, partnerUserId: string | null) {
  const userPhoto = moment.photos.find((p) => p.userId === currentUserId)?.imageUrl || null;
  const partnerPhoto = partnerUserId
    ? moment.photos.find((p) => p.userId === partnerUserId)?.imageUrl || null
    : null;

  const userReaction = moment.reactions[currentUserId] || null;
  const partnerReaction = partnerUserId ? moment.reactions[partnerUserId] || null : null;

  let computedStatus = moment.status;

  if (moment.status !== 'COMPLETED') {
    if (moment.status === 'REACTED' || (userReaction && partnerReaction)) {
      computedStatus = 'REACTED';
    } else if (moment.revealed) {
      computedStatus = 'REVEALED';
    } else if (userPhoto && partnerPhoto) {
      computedStatus = 'BOTH_UPLOADED';
    } else if (userPhoto) {
      computedStatus = 'USER_UPLOADED';
    } else {
      computedStatus = 'EMPTY';
    }
  }

  return {
    ...moment,
    userPhoto,
    partnerPhoto,
    userReaction,
    partnerReaction,
    status: computedStatus,
  };
}

// ============================================================================
// Authentication Middleware
// ============================================================================
interface AuthenticatedRequest extends Request {
  user?: DbUser;
}

function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = (req.headers['x-session-token'] as string) || (req.headers['authorization']?.replace('Bearer ', '') as string);
  if (token && db.tokens[token]) {
    const userId = db.tokens[token];
    const user = db.users[userId];
    if (user) {
      user.lastActiveAt = new Date().toISOString();
      req.user = user;
    }
  }
  next();
}

// ============================================================================
// Server Application Setup
// ============================================================================
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(authMiddleware);

  // --------------------------------------------------------------------------
  // API Routes
  // --------------------------------------------------------------------------

  // 1. Session Init / Restore
  app.post('/api/auth/session', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    let isNewUser = false;

    if (!user) {
      // Create a brand new anonymous user
      const id = generateId('usr');
      const token = generateToken();
      user = {
        id,
        token,
        displayName: '',
        avatarUrl: null,
        avatarColor: getRandomAvatarColor(),
        currentPairId: null,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      db.users[id] = user;
      db.tokens[token] = id;
      persistDatabase();
      isNewUser = true;
    }

    // Lookup pair if user has one
    let pairData: DbPair | null = null;
    let partnerUser: DbUser | null = null;
    let momentsList: any[] = [];
    let historyList: DbHistoryDay[] = [];

    if (user.currentPairId && db.pairs[user.currentPairId]) {
      pairData = db.pairs[user.currentPairId];
      const partnerId = pairData.userAId === user.id ? pairData.userBId : pairData.userAId;
      if (partnerId && db.users[partnerId]) {
        partnerUser = db.users[partnerId];
      }

      // Get or create today's moments
      const todayKey = getLocalDateKey();
      let pMoments = db.moments[pairData.id];
      if (!pMoments || pMoments.length === 0 || pMoments[0]?.dateKey !== todayKey) {
        pMoments = createDefaultMomentsForPair(pairData.id, todayKey);
        db.moments[pairData.id] = pMoments;
        persistDatabase();
      }

      momentsList = pMoments.map((m) => formatMomentClientView(m, user!.id, partnerId));
      historyList = db.history[pairData.id] || [];
    }

    const hasCompletedOnboarding = Boolean(user.displayName && pairData);

    return res.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor,
        currentPairId: user.currentPairId,
        createdAt: user.createdAt,
      },
      token: user.token,
      isNewUser,
      hasCompletedOnboarding,
      pair: pairData
        ? {
            id: pairData.id,
            inviteCode: pairData.inviteCode,
            startDate: pairData.startDate,
            daysTogether: 1,
            isLovely: pairData.isLovely,
            lovelyPurchasedAt: pairData.lovelyPurchasedAt,
            subscription: pairData.subscription,
            status: pairData.status,
            connected: Boolean(pairData.userBId),
            user: {
              id: user.id,
              name: user.displayName,
              avatarUrl: user.avatarUrl,
              avatarColor: user.avatarColor,
            },
            partner: {
              id: partnerUser?.id || (pairData.userAId === user.id ? 'pending-partner' : pairData.userAId),
              name: partnerUser?.displayName || (pairData.status === 'pending' ? 'Ожидание партнёра' : 'Партнёр'),
              avatarUrl: partnerUser?.avatarUrl || null,
              avatarColor: partnerUser?.avatarColor || '#DDEAF7',
            },
          }
        : null,
      moments: momentsList,
      history: historyList,
    });
  });

  // 2. Create Pair
  app.post('/api/pairs/create', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized session' });
    }

    const { userName, customInviteCode } = req.body;
    if (userName && typeof userName === 'string') {
      user.displayName = userName.trim();
    }

    const inviteCode = (customInviteCode && typeof customInviteCode === 'string' && customInviteCode.trim().length >= 4)
      ? customInviteCode.trim().toUpperCase()
      : generateInviteCode();

    const pairId = generateId('pair');
    const newPair: DbPair = {
      id: pairId,
      inviteCode,
      userAId: user.id,
      userBId: null,
      startDate: formatRussianDate(new Date()),
      createdAt: new Date().toISOString(),
      isLovely: false,
      subscription: 'free',
      status: 'pending',
    };

    db.pairs[pairId] = newPair;
    db.pairsByInviteCode[inviteCode] = pairId;
    user.currentPairId = pairId;

    // Create fresh moments for today
    const todayKey = getLocalDateKey();
    const moments = createDefaultMomentsForPair(pairId, todayKey);
    db.moments[pairId] = moments;
    db.history[pairId] = [];

    persistDatabase();

    const formattedMoments = moments.map((m) => formatMomentClientView(m, user!.id, null));

    return res.json({
      success: true,
      pair: {
        id: newPair.id,
        inviteCode: newPair.inviteCode,
        startDate: newPair.startDate,
        daysTogether: 1,
        isLovely: newPair.isLovely,
        subscription: newPair.subscription,
        status: newPair.status,
        connected: false,
        user: {
          id: user.id,
          name: user.displayName,
          avatarUrl: user.avatarUrl,
          avatarColor: user.avatarColor,
        },
        partner: {
          id: 'pending-partner',
          name: 'Ожидание партнёра',
          avatarUrl: null,
          avatarColor: '#DDEAF7',
        },
      },
      moments: formattedMoments,
      history: [],
    });
  });

  // 3. Join Pair
  app.post('/api/pairs/join', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized session' });
    }

    const { userName, inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Не указан код приглашения' });
    }

    if (userName && typeof userName === 'string') {
      user.displayName = userName.trim();
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    const pairId = db.pairsByInviteCode[cleanCode];

    if (!pairId || !db.pairs[pairId]) {
      return res.status(404).json({ success: false, error: 'Пара с таким кодом не найдена. Проверь код приглашения.' });
    }

    const targetPair = db.pairs[pairId];

    if (targetPair.userAId === user.id) {
      // User is joining their own created pair -> accept
      user.currentPairId = targetPair.id;
    } else if (targetPair.userBId && targetPair.userBId !== user.id) {
      return res.status(400).json({ success: false, error: 'В этой паре уже зарегистрированы два участника.' });
    } else {
      // Assign User B to Pair
      targetPair.userBId = user.id;
      targetPair.status = 'active';
      user.currentPairId = targetPair.id;
    }

    const partnerId = targetPair.userAId === user.id ? targetPair.userBId : targetPair.userAId;
    const partnerUser = partnerId ? db.users[partnerId] : null;

    // Ensure moments exist
    const todayKey = getLocalDateKey();
    let pMoments = db.moments[targetPair.id];
    if (!pMoments || pMoments.length === 0 || pMoments[0]?.dateKey !== todayKey) {
      pMoments = createDefaultMomentsForPair(targetPair.id, todayKey);
      db.moments[targetPair.id] = pMoments;
    }

    persistDatabase();

    const formattedMoments = pMoments.map((m) => formatMomentClientView(m, user!.id, partnerId));
    const historyList = db.history[targetPair.id] || [];

    return res.json({
      success: true,
      pair: {
        id: targetPair.id,
        inviteCode: targetPair.inviteCode,
        startDate: targetPair.startDate,
        daysTogether: 1,
        isLovely: targetPair.isLovely,
        lovelyPurchasedAt: targetPair.lovelyPurchasedAt,
        subscription: targetPair.subscription,
        status: targetPair.status,
        connected: Boolean(targetPair.userBId),
        user: {
          id: user.id,
          name: user.displayName,
          avatarUrl: user.avatarUrl,
          avatarColor: user.avatarColor,
        },
        partner: {
          id: partnerUser?.id || 'partner',
          name: partnerUser?.displayName || 'Партнёр',
          avatarUrl: partnerUser?.avatarUrl || null,
          avatarColor: partnerUser?.avatarColor || '#DDEAF7',
        },
      },
      moments: formattedMoments,
      history: historyList,
    });
  });

  // 4. Update Profile
  app.patch('/api/users/me', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized session' });
    }

    const { name, displayName, avatarUrl, avatarColor } = req.body;
    if (name !== undefined || displayName !== undefined) {
      user.displayName = (name || displayName || '').trim();
    }
    if (avatarUrl !== undefined) {
      user.avatarUrl = avatarUrl;
    }
    if (avatarColor !== undefined) {
      user.avatarColor = avatarColor;
    }

    persistDatabase();

    return res.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor,
        currentPairId: user.currentPairId,
      },
    });
  });

  // 5. Get Current Pair State (for Live Polling & Synchronization)
  app.get('/api/pairs/current', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId || !db.pairs[user.currentPairId]) {
      return res.status(200).json({ success: true, pair: null, moments: [], history: [] });
    }

    const pair = db.pairs[user.currentPairId];
    const partnerId = pair.userAId === user.id ? pair.userBId : pair.userAId;
    const partnerUser = partnerId ? db.users[partnerId] : null;

    const todayKey = getLocalDateKey();
    let pMoments = db.moments[pair.id];
    if (!pMoments || pMoments.length === 0 || pMoments[0]?.dateKey !== todayKey) {
      pMoments = createDefaultMomentsForPair(pair.id, todayKey);
      db.moments[pair.id] = pMoments;
      persistDatabase();
    }

    const formattedMoments = pMoments.map((m) => formatMomentClientView(m, user!.id, partnerId));
    const historyList = db.history[pair.id] || [];

    return res.json({
      success: true,
      pair: {
        id: pair.id,
        inviteCode: pair.inviteCode,
        startDate: pair.startDate,
        daysTogether: 1,
        isLovely: pair.isLovely,
        lovelyPurchasedAt: pair.lovelyPurchasedAt,
        subscription: pair.subscription,
        status: pair.status,
        connected: Boolean(pair.userBId),
        user: {
          id: user.id,
          name: user.displayName,
          avatarUrl: user.avatarUrl,
          avatarColor: user.avatarColor,
        },
        partner: {
          id: partnerUser?.id || (pair.userAId === user.id ? 'pending-partner' : pair.userAId),
          name: partnerUser?.displayName || (pair.status === 'pending' ? 'Ожидание партнёра' : 'Партнёр'),
          avatarUrl: partnerUser?.avatarUrl || null,
          avatarColor: partnerUser?.avatarColor || '#DDEAF7',
        },
      },
      moments: formattedMoments,
      history: historyList,
    });
  });

  // 6. Upload Photo for a Moment
  app.post('/api/moments/:momentId/photo', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { momentId } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl || typeof photoUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Не передано фото' });
    }

    const pairMoments = db.moments[user.currentPairId];
    if (!pairMoments) {
      return res.status(404).json({ success: false, error: 'Моменты пары не найдены' });
    }

    const moment = pairMoments.find((m) => m.id === momentId);
    if (!moment) {
      return res.status(404).json({ success: false, error: 'Момент не найден' });
    }

    // Add or replace photo for this user
    const existingIdx = moment.photos.findIndex((p) => p.userId === user!.id);
    const photoEntry: DbMomentPhoto = {
      userId: user.id,
      imageUrl: photoUrl,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      moment.photos[existingIdx] = photoEntry;
    } else {
      moment.photos.push(photoEntry);
    }

    // Check if partner photo also exists
    const pair = db.pairs[user.currentPairId];
    const partnerId = pair.userAId === user.id ? pair.userBId : pair.userAId;
    const hasPartnerPhoto = partnerId ? moment.photos.some((p) => p.userId === partnerId) : false;

    if (hasPartnerPhoto) {
      moment.status = 'BOTH_UPLOADED';
    } else {
      moment.status = 'USER_UPLOADED';
    }

    persistDatabase();

    const formatted = formatMomentClientView(moment, user.id, partnerId);
    return res.json({ success: true, moment: formatted });
  });

  // 7. Reveal Moment (after MATCH animation)
  app.post('/api/moments/:momentId/reveal', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { momentId } = req.params;
    const pairMoments = db.moments[user.currentPairId];
    const moment = pairMoments?.find((m) => m.id === momentId);
    if (!moment) {
      return res.status(404).json({ success: false, error: 'Момент не найден' });
    }

    moment.revealed = true;
    moment.status = 'REVEALED';
    persistDatabase();

    const pair = db.pairs[user.currentPairId];
    const partnerId = pair.userAId === user.id ? pair.userBId : pair.userAId;
    const formatted = formatMomentClientView(moment, user.id, partnerId);
    return res.json({ success: true, moment: formatted });
  });

  // 8. Submit Reaction
  app.post('/api/moments/:momentId/reaction', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { momentId } = req.params;
    const { emoji } = req.body;

    const pairMoments = db.moments[user.currentPairId];
    const moment = pairMoments?.find((m) => m.id === momentId);
    if (!moment) {
      return res.status(404).json({ success: false, error: 'Момент не найден' });
    }

    moment.reactions[user.id] = emoji;
    moment.status = 'REACTED';
    persistDatabase();

    const pair = db.pairs[user.currentPairId];
    const partnerId = pair.userAId === user.id ? pair.userBId : pair.userAId;
    const formatted = formatMomentClientView(moment, user.id, partnerId);
    return res.json({ success: true, moment: formatted });
  });

  // 9. Complete Moment
  app.post('/api/moments/:momentId/complete', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { momentId } = req.params;
    const pairMoments = db.moments[user.currentPairId];
    const moment = pairMoments?.find((m) => m.id === momentId);
    if (!moment) {
      return res.status(404).json({ success: false, error: 'Момент не найден' });
    }

    const nowTs = Date.now();
    moment.status = 'COMPLETED';
    moment.completedTimestamp = nowTs;
    moment.completedAt = new Date(nowTs).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    persistDatabase();

    const pair = db.pairs[user.currentPairId];
    const partnerId = pair.userAId === user.id ? pair.userBId : pair.userAId;
    const formatted = formatMomentClientView(moment, user.id, partnerId);
    return res.json({ success: true, moment: formatted });
  });

  // 10. Purchase LOVELY for Pair
  app.post('/api/pairs/lovely', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId || !db.pairs[user.currentPairId]) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const pair = db.pairs[user.currentPairId];
    pair.isLovely = true;
    pair.lovelyPurchasedAt = new Date().toISOString();
    pair.subscription = 'premium';
    persistDatabase();

    return res.json({
      success: true,
      isLovely: true,
      lovelyPurchasedAt: pair.lovelyPurchasedAt,
    });
  });

  // 11. Reset LOVELY for Pair (Demo/Testing)
  app.post('/api/pairs/reset-lovely', (req: AuthenticatedRequest, res: Response) => {
    let user = req.user;
    if (!user || !user.currentPairId || !db.pairs[user.currentPairId]) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const pair = db.pairs[user.currentPairId];
    pair.isLovely = false;
    pair.lovelyPurchasedAt = undefined;
    pair.subscription = 'free';
    persistDatabase();

    return res.json({
      success: true,
      isLovely: false,
    });
  });

  // 12. Dev Reset Session (to simulate opening on a completely new browser)
  app.post('/api/dev/reset-user', (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (user) {
      delete db.tokens[user.token];
      delete db.users[user.id];
      persistDatabase();
    }
    return res.json({ success: true, message: 'Session reset' });
  });

  // --------------------------------------------------------------------------
  // Vite Middleware (Dev) or Static Assets (Prod)
  // --------------------------------------------------------------------------
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OURS] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

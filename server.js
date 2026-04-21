// ═══════════════════════════════════════════════════════════════════════
// SERVER.JS — TaskMarket Bot  (arquitectura nativa Telegram)
//
// Sem webapp. Sem miniapp. Tudo por comandos e inline keyboards.
//
// Comandos públicos:
//   /start       — registo + referência + menu principal (robusto, não falha)
//   /saldo       — carteira com inline actions
//   /depositar   — invoice xRocket, polling + webhook, crédito automático
//   /sacar       — saque com validação de endereço TON
//   /tarefas     — listagem paginada + aceitar tarefa
//   /criar       — criação de tarefa por FSM (etapas)
//   /cancelar    — cancelar tarefa open e reaver saldo
//   /referral    — link + progress bar + leaderboard
//   /minhas      — tarefas do utilizador (anunciante + executor)
//   /ajuda       — menu de ajuda
//
// Painel Admin (/admin — apenas ID 7991785009):
//   stats        — utilizadores, tarefas, volume
//   listar users — top utilizadores por saldo
//   disputas     — disputas abertas
//   broadcast    — mensagem para todos os utilizadores
//   forçar estado — alterar estado de tarefa
//
// Jobs internos:
//   Reminder 24h — notifica anunciantes com pending_review
//   FSM timeout  — limpa estados abandonados após 30min
//
// Realtime:
//   tasks        — notificações de aceitação e conclusão
//   transactions — notificações de depósito via Supabase
//
// Webhook xRocket — endpoint /xrocket-webhook para confirmação instantânea
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const https = require('https');
const http  = require('http');
const { createClient } = require('@supabase/supabase-js');

// ── Env ───────────────────────────────────────────────────────────────
const BOT_TOKEN    = process.env.BOT_TOKEN;
const PORT         = parseInt(process.env.PORT || '3000', 10);
const ADMIN_ID     = 7991785009;
const BOT_USERNAME = (process.env.BOT_USERNAME || 'TaskMarket_Bot').trim();
const RENDER_URL   = (process.env.RENDER_EXTERNAL_URL || '').trim();
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;
const XROCKET_WEBHOOK_PATH = '/xrocket-webhook';
const XROCKET_TOKEN = process.env.XROCKET_TOKEN;

// ── Supabase ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Constantes ────────────────────────────────────────────────────────
const REFERRAL_BONUS        = 0.01;
const MIN_REFS_WITHDRAW     = 25;
const LISTING_FEE           = 0.05; // fallback (não usado directamente)
const LISTING_FEES          = { join_channel: 2, join_group: 2, join_bot: 2 };
const TASKS_PER_PAGE        = 5;
const DEPOSIT_AMOUNTS       = [0.5, 1, 2, 5, 10];
const FSM_TIMEOUT_MS        = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS  = 60 * 60 * 1000;
const PENDING_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

// ── Tarefa nativa — publicidade Sweetcoin ────────────────────────────
const PROMO_TASK = {
  id:          'promo_sweetcoin',
  title:       'Make Real Money Just by Walking!',
  task_type:   'promo',
  reward:      0,
  description:
    'Turn every step into rewards with Sweetcoin.\n\n' +
    '🔥 Ultimate Challenge:\n' +
    'Invite 20 friends and get $10 directly to your PayPal!\n' +
    'The more you walk and invite, the more you earn.',
  target_link:     'https://swcapp.com/i/orlandojaime27142264868',
  slots_remaining: 9999,
  status:          'open',
  is_promo:        true,
};

// ── Validação de arranque ─────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('  TaskMarket Bot — arquitectura nativa Telegram');
console.log(`  Token   : ${BOT_TOKEN ? BOT_TOKEN.slice(0,12)+'…' : '❌ EM FALTA'}`);
console.log(`  Render  : ${RENDER_URL || '⚠️  em falta'}`);
console.log(`  Supa    : ${process.env.SUPABASE_URL ? '✅' : '❌ EM FALTA'}`);
console.log(`  SvcKey  : ${process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌ EM FALTA'}`);
console.log(`  xRocket : ${XROCKET_TOKEN ? '✅' : '⚠️  em falta'}`);
console.log(`  Admin   : ${ADMIN_ID}`);
console.log('══════════════════════════════════════════════════\n');

if (!BOT_TOKEN)                        { console.error('FATAL: BOT_TOKEN em falta');            process.exit(1); }
if (!process.env.SUPABASE_URL)         { console.error('FATAL: SUPABASE_URL em falta');         process.exit(1); }
if (!process.env.SUPABASE_SERVICE_KEY) { console.error('FATAL: SUPABASE_SERVICE_KEY em falta'); process.exit(1); }

// ═══════════════════════════════════════════════════════════════════════
// STATE — FSM por utilizador
// ═══════════════════════════════════════════════════════════════════════
const userState = new Map();
// Referrals pendentes: telegram_id → referrerTelegramId
// Guardado imediatamente no /start, consumido pelo getOrCreateUser
const pendingReferrals = new Map();

function getState(tid)        { return userState.get(tid) || null; }
function setState(tid, state) { userState.set(tid, { ...state, createdAt: Date.now() }); }
function clearState(tid)      { userState.delete(tid); }

function sweepExpiredStates() {
  const now = Date.now();
  for (const [tid, state] of userState.entries()) {
    if (now - (state.createdAt || 0) > FSM_TIMEOUT_MS) {
      userState.delete(tid);
      sendMessage(tid, '⏱ A tua sessão expirou. Usa /start para recomeçar.').catch(() => {});
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TELEGRAM API
// ═══════════════════════════════════════════════════════════════════════

function tgCall(method, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/${method}`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          if (!r.ok) console.error(`[tg:${method}] ❌ ${r.description}`);
          resolve(r);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', err => { console.error(`[tg:${method}]`, err.message); reject(err); });
    req.write(payload);
    req.end();
  });
}

const sendMessage    = (chatId, text, extra = {}) =>
  tgCall('sendMessage', { chat_id: chatId, text, ...extra });
const editMessage    = (chatId, msgId, text, extra = {}) =>
  tgCall('editMessageText', { chat_id: chatId, message_id: msgId, text, ...extra });
const editMarkup     = (chatId, msgId, reply_markup) =>
  tgCall('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup });
const answerCallback = (id, text = '', alert = false) =>
  tgCall('answerCallbackQuery', { callback_query_id: id, text, show_alert: alert });
const deleteMessage  = (chatId, msgId) =>
  tgCall('deleteMessage', { chat_id: chatId, message_id: msgId });

// ═══════════════════════════════════════════════════════════════════════
// XROCKET API
// ═══════════════════════════════════════════════════════════════════════

function xrocketCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'pay.xrocket.tg',
      path,
      method,
      headers: {
        'Rocket-Pay-Key': XROCKET_TOKEN,
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('error', err => { console.error(`[xrocket:${path}]`, err.message); reject(err); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function createXRocketInvoice(amount) {
  if (!XROCKET_TOKEN) return null;
  try {
    const r = await xrocketCall('POST', '/tg-invoices', {
      amount: String(amount), currency: 'TONCOIN', description: 'Depósito TaskMarket',
    });
    return r?.data || null;
  } catch (e) { console.error('[xrocket:createInvoice]', e.message); return null; }
}

async function getXRocketInvoiceStatus(invoiceId) {
  if (!XROCKET_TOKEN) return null;
  try {
    const r = await xrocketCall('GET', `/tg-invoices/${invoiceId}`);
    return r?.data?.status || null;
  } catch (e) { console.error('[xrocket:invoiceStatus]', e.message); return null; }
}

async function sendXRocketTransfer(address, amount) {
  if (!XROCKET_TOKEN) return null;
  try {
    const r = await xrocketCall('POST', '/withdrawal/transfer', {
      network: 'ton', address, amount: String(amount), currency: 'TONCOIN',
    });
    return r?.data || null;
  } catch (e) { console.error('[xrocket:transfer]', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════

async function getUser(telegramId) {
  const { data, error } = await supabase
    .from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
  if (error) console.error('[db:getUser]', error.code, error.message);
  return data || null;
}

async function getUserById(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  return data || null;
}

// getOrCreateUser — estratégia premium
// Garante que o referral é sempre processado mesmo que o user
// tenha clicado num botão antes do background do /start terminar.
// O pendingReferrals é gravado sincronamente no /start (0ms),
// portanto nunca se perde independentemente da velocidade da BD.
async function getOrCreateUser(from) {
  let user = await getUser(from.id);
  if (!user) {
    try {
      user = await createUser(from);
    } catch (_) {
      user = await getUser(from.id);
    }
    // Aplica referral pendente se existir
    if (user) {
      const refTelegramId = pendingReferrals.get(from.id);
      if (refTelegramId && refTelegramId !== from.id) {
        pendingReferrals.delete(from.id);
        const referrer = await getUser(refTelegramId).catch(() => null);
        if (referrer && !user.referred_by) {
          await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id).catch(() => {});
          await processReferral(refTelegramId, user.id, from).catch(() => {});
          console.log(`[getOrCreateUser] referral recuperado tg=${from.id} → referrer.id=${referrer.id}`);
        }
      }
    }
  } else {
    updateUserProfile(from).catch(() => {});
  }
  return user;
}

async function createUser(from) {
  const { data, error } = await supabase.from('users').insert({
    telegram_id: from.id, username: from.username || null,
    first_name: from.first_name || '', last_name: from.last_name || '',
    balance: 0, referral_count: 0, referred_by: null,
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) {
    if (error.code === '23505') return getUser(from.id);
    if (error.code === '42501') console.error('[db:createUser] ❌ RLS bloqueou INSERT');
    throw error;
  }
  return data;
}

async function updateUserProfile(from) {
  await supabase.from('users').update({
    username: from.username || null,
    first_name: from.first_name || '',
    last_name: from.last_name || '',
  }).eq('telegram_id', from.id);
}

async function creditUser(userId, amount) {
  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  const newBalance = parseFloat(((user?.balance || 0) + amount).toFixed(6));
  await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
  return newBalance;
}

async function debitUser(userId, amount) {
  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  const newBalance = parseFloat(((user?.balance || 0) - amount).toFixed(6));
  if (newBalance < 0) throw new Error('saldo_insuficiente');
  await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
  return newBalance;
}

async function logTx(userId, type, amount, note = '') {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId, type, amount, note, created_at: new Date().toISOString(),
  });
  if (error) console.error('[db:logTx]', error.message);
}

async function creditDepositIdempotent(userId, amount, invoiceId) {
  const { data: existing } = await supabase.from('transactions').select('id')
    .eq('user_id', userId).ilike('note', `%${invoiceId}%`).maybeSingle();
  if (existing) { console.warn(`[deposit] duplo crédito ignorado: ${invoiceId}`); return null; }
  const newBalance = await creditUser(userId, amount);
  await logTx(userId, 'deposit', amount, `Depósito xRocket · ${invoiceId}`);
  await supabase.from('deposit_invoices').update({ status: 'paid' }).eq('invoice_id', invoiceId);
  return newBalance;
}

// ═══════════════════════════════════════════════════════════════════════
// REFERRALS
// ═══════════════════════════════════════════════════════════════════════

// processReferral — referrerTelegramId é telegram_id; newUserId é UUID da BD
async function processReferral(referrerTelegramId, newUserId, from) {
  if (!referrerTelegramId || referrerTelegramId === from.id) return;

  const referrer = await getUser(referrerTelegramId);
  if (!referrer) {
    console.warn(`[referral] referrer tg=${referrerTelegramId} não encontrado`);
    return;
  }

  // Anti-duplo: verifica por UUIDs na tabela referrals
  const { data: dup } = await supabase.from('referrals').select('id')
    .eq('referrer_id', referrer.id).eq('referred_id', newUserId).maybeSingle();
  if (dup) {
    console.warn(`[referral] duplicado ignorado referrer=${referrer.id} referred=${newUserId}`);
    return;
  }

  const novoCount = (referrer.referral_count || 0) + 1;

  // Actualiza pelo UUID — nunca pelo telegram_id
  await supabase.from('users').update({
    balance: parseFloat(((referrer.balance || 0) + REFERRAL_BONUS).toFixed(6)),
    referral_count: novoCount,
  }).eq('id', referrer.id);

  // Insere referral com UUIDs correctos
  await supabase.from('referrals').insert({
    referrer_id: referrer.id,
    referred_id: newUserId,
    bonus_paid:  REFERRAL_BONUS,
    created_at:  new Date().toISOString(),
  });

  await logTx(referrer.id, 'referral', REFERRAL_BONUS,
    `Referência: @${from.username || from.first_name || from.id}`);

  console.log(`[referral] ✅ referrer.id=${referrer.id} tg=${referrerTelegramId} count=${novoCount} referred=${newUserId}`);

  const faltam = MIN_REFS_WITHDRAW - novoCount;
  await sendMessage(referrerTelegramId,
    `🎉 *Nova referência!*\n\n` +
    `@${from.username || from.first_name || 'utilizador'} entrou pelo teu link.\n` +
    `💎 *+${REFERRAL_BONUS} TON* creditado!\n` +
    `📊 *${novoCount}/${MIN_REFS_WITHDRAW}* referências\n\n` +
    (faltam <= 0 ? `✅ Atingiste o mínimo! Usa /sacar.` : `⏳ Faltam *${faltam}* para sacar.`),
    { parse_mode: 'Markdown' }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════

const KB = {
  mainMenu: () => ({
    inline_keyboard: [
      [{ text: '💰 Saldo & Carteira', callback_data: 'menu_saldo'    },
       { text: '📋 Ver Tarefas',      callback_data: 'menu_tarefas'  }],
      [{ text: '➕ Criar Tarefa',     callback_data: 'menu_criar'    },
       { text: '👥 Referral',         callback_data: 'menu_referral' }],
      [{ text: '📁 Minhas Tarefas',   callback_data: 'menu_minhas'   },
       { text: '❓ Ajuda',            callback_data: 'menu_ajuda'    }],
    ]
  }),

  depositAmounts: () => ({
    inline_keyboard: [
      DEPOSIT_AMOUNTS.slice(0,3).map(a => ({ text: `${a} TON`, callback_data: `dep_${a}` })),
      DEPOSIT_AMOUNTS.slice(3).map(a =>   ({ text: `${a} TON`, callback_data: `dep_${a}` })),
      [{ text: '✏️ Outro valor', callback_data: 'dep_custom' }],
      [{ text: '◀️ Voltar',      callback_data: 'menu_saldo'  }],
    ]
  }),

  depositPaying: (invoiceId, link) => ({
    inline_keyboard: [
      [{ text: '🚀 Pagar via xRocket', url: link }],
      [{ text: '🔄 Verificar pagamento', callback_data: `dep_check_${invoiceId}` },
       { text: '❌ Cancelar',            callback_data: 'dep_cancel'             }],
    ]
  }),

  taskList: (tasks, page, total, showPromo = false) => {
    const rows = [];
    if (showPromo) {
      rows.push([{ text: '🌟 [PROMO] Make Real Money Just by Walking!', callback_data: 'task_view_promo_sweetcoin' }]);
    }
    tasks.forEach(t => rows.push([{
      text: `${taskTypeEmoji(t.task_type)} ${t.title} — ${t.reward} TON`,
      callback_data: `task_view_${t.id}`,
    }]));
    const nav = [];
    if (page > 0)                             nav.push({ text: '◀️', callback_data: `tasks_page_${page - 1}` });
    if ((page + 1) * TASKS_PER_PAGE < total)  nav.push({ text: '▶️', callback_data: `tasks_page_${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push([{ text: '◀️ Menu', callback_data: 'menu_main' }]);
    return { inline_keyboard: rows };
  },

  taskDetail: (task, userId) => {
    const rows = [];
    if (task.is_promo) {
      rows.push([{ text: '👉 Abrir Sweetcoin', url: task.target_link }]);
      rows.push([{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }]);
      return { inline_keyboard: rows };
    }
    if (task.status === 'open' && task.advertiser_id !== userId && (task.slots_remaining || 0) > 0)
      rows.push([{ text: '✅ Aceitar tarefa', callback_data: `task_accept_${task.id}` }]);
    if (task.status === 'in_progress' && task.executor_id === userId)
      rows.push([{ text: '📤 Submeter para revisão', callback_data: `task_submit_${task.id}` }]);
    if (task.status === 'pending_review' && task.advertiser_id === userId)
      rows.push([
        { text: '✅ Aprovar',  callback_data: `task_approve_${task.id}` },
        { text: '⚠️ Disputar', callback_data: `task_dispute_${task.id}` },
      ]);
    if (task.status === 'open' && task.advertiser_id === userId)
      rows.push([{ text: '🗑 Cancelar tarefa', callback_data: `task_cancel_${task.id}` }]);
    rows.push([{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }]);
    return { inline_keyboard: rows };
  },

  taskTypes: () => ({
    inline_keyboard: [
      [{ text: '📢 Seguir Canal',    callback_data: 'create_type_join_channel' }],
      [{ text: '👥 Entrar em Grupo', callback_data: 'create_type_join_group'   }],
      [{ text: '🤖 Iniciar Bot',     callback_data: 'create_type_join_bot'     }],
      [{ text: '❌ Cancelar',        callback_data: 'create_cancel'            }],
    ]
  }),

  createConfirm: () => ({
    inline_keyboard: [
      [{ text: '✅ Confirmar e Publicar', callback_data: 'create_confirm' }],
      [{ text: '❌ Cancelar',             callback_data: 'create_cancel'  }],
    ]
  }),

  withdrawCancel: () => ({
    inline_keyboard: [[{ text: '❌ Cancelar saque', callback_data: 'withdraw_cancel' }]]
  }),

  disputeAdmin: (taskId) => ({
    inline_keyboard: [[
      { text: '✅ Pagar executor',        callback_data: `dispute_accept_${taskId}` },
      { text: '❌ Reembolsar anunciante', callback_data: `dispute_reject_${taskId}` },
    ]]
  }),

  adminMenu: () => ({
    inline_keyboard: [
      [{ text: '📊 Stats',          callback_data: 'adm_stats'      },
       { text: '👥 Top Users',      callback_data: 'adm_users'      }],
      [{ text: '⚠️ Disputas',       callback_data: 'adm_disputes'   },
       { text: '📋 Tarefas',        callback_data: 'adm_tasks'      }],
      [{ text: '📣 Broadcast',      callback_data: 'adm_broadcast'  },
       { text: '🔧 Forçar estado',  callback_data: 'adm_forcestate' }],
      [{ text: '💳 Invoices pend.', callback_data: 'adm_invoices'   }],
    ]
  }),

  backToMenu:  () => ({ inline_keyboard: [[{ text: '◀️ Menu Principal', callback_data: 'menu_main' }]] }),
  backToAdmin: () => ({ inline_keyboard: [[{ text: '◀️ Painel Admin',   callback_data: 'adm_menu'  }]] }),
};

function taskTypeEmoji(type) {
  return { join_channel: '📢', join_group: '👥', join_bot: '🤖', promo: '🌟' }[type] || '📋';
}
function taskTypeLabel(type) {
  return { join_channel: 'Seguir Canal', join_group: 'Entrar em Grupo', join_bot: 'Iniciar Bot', promo: 'Promoção' }[type] || type;
}
function statusEmoji(status) {
  return { open: '🟡', in_progress: '🔵', pending_review: '🟠', done: '✅', cancelled: '❌', disputed: '⚠️' }[status] || '⬜';
}
function statusLabel(status) {
  return { open: 'Aberta', in_progress: 'Em progresso', pending_review: 'Aguarda revisão', done: 'Concluída', cancelled: 'Cancelada', disputed: 'Em disputa' }[status] || status;
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLERS — COMANDOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════════════

async function handleStart(msg) {
  const chatId = msg.chat.id;
  const from   = msg.from;
  const rawPayload = (msg.text || '').trim().split(/\s+/).slice(1).join('');
  const referrerTelegramId = (rawPayload && /^r\d+$/.test(rawPayload))
    ? parseInt(rawPayload.slice(1), 10)
    : null;

  console.log(`[/start] tg=${from.id} @${from.username || '—'} ref=${referrerTelegramId || '—'}`);

  clearState(from.id);

  // ── PASSO 1 (síncrono, 0ms) ─────────────────────────────────────────
  // Guarda o referral em memória ANTES de qualquer I/O.
  // Se o user clicar num botão antes da BD responder,
  // getOrCreateUser vai encontrar este valor e aplicá-lo.
  if (referrerTelegramId && referrerTelegramId !== from.id) {
    pendingReferrals.set(from.id, referrerTelegramId);
  }

  // ── PASSO 2 — menu imediato ─────────────────────────────────────────
  const nome = from.first_name || 'utilizador';
  await sendMessage(chatId,
    `👋 Olá, *${nome}*!\n\nO que queres fazer?`,
    { parse_mode: 'Markdown', reply_markup: KB.mainMenu() }
  ).catch(() => {});

  // ── PASSO 3 — registo + referral em background ──────────────────────
  try {
    let user = await getUser(from.id);
    const isNew = !user;

    if (isNew) {
      user = await createUser(from);
      console.log(`[/start] novo user: id=${user.id} tg=${from.id}`);
    } else {
      updateUserProfile(from).catch(() => {});
    }

    // Processa referral (novo ou retroactivo)
    if (referrerTelegramId && referrerTelegramId !== from.id) {
      const alreadyReferred = !isNew && user.referred_by;
      if (!alreadyReferred) {
        const referrer = await getUser(referrerTelegramId);
        if (referrer) {
          // Garante referred_by com UUID correcto
          if (!user.referred_by) {
            await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id);
          }
          await processReferral(referrerTelegramId, user.id, from);
        }
      }
      // Referral processado — remove do mapa pendente
      pendingReferrals.delete(from.id);
    }

    if (isNew) {
      await sendMessage(chatId,
        `✅ *Bem-vindo ao TaskMarket!*\n\n` +
        `📋 Completa tarefas e ganha *TON*\n` +
        `➕ Publica tarefas e paga executores\n` +
        `👥 *+${REFERRAL_BONUS} TON* por cada referência\n` +
        `💎 ${MIN_REFS_WITHDRAW} referências para sacar`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

  } catch (err) {
    console.error('[/start:bg] ❌', err.message, err.code || '');
    // Menu já foi mostrado — utilizador não vê erro
    // pendingReferrals mantém-se para ser consumido pelo getOrCreateUser
  }
}

// ── /inicio — mantido por compatibilidade, delega para handleStart ──
async function handleInicio(msg) {
  return handleStart(msg);
}

async function handleSaldo(msg) {
  const user = await getOrCreateUser(msg.from);
  const refs  = user.referral_count || 0;
  const saldo = (user.balance || 0).toFixed(4);
  const prog  = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar   = '█'.repeat(prog) + '░'.repeat(10 - prog);
  await sendMessage(msg.chat.id,
    `💎 *Carteira TaskMarket*\n\nSaldo: *${saldo} TON*\n\n👥 Referências: *${refs}/${MIN_REFS_WITHDRAW}*\n${bar}\n\n` +
    (refs >= MIN_REFS_WITHDRAW ? `✅ Saque disponível — /sacar` : `⏳ Faltam *${MIN_REFS_WITHDRAW - refs}* para sacar.`),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Depositar TON', callback_data: 'menu_depositar' },
           { text: '💸 Sacar TON',     callback_data: 'menu_sacar'     }],
          [{ text: '◀️ Menu Principal',callback_data: 'menu_main'      }],
        ]
      }
    }
  );
}

async function handleDepositar(msg) {
  const user = await getOrCreateUser(msg.from);
  await sendMessage(msg.chat.id,
    `💰 *Depositar TON via xRocket*\n\nEscolhe o valor:`,
    { parse_mode: 'Markdown', reply_markup: KB.depositAmounts() }
  );
}

async function handleSacar(msg) {
  const user = await getOrCreateUser(msg.from);
  const refs = user.referral_count || 0;
  if (refs < MIN_REFS_WITHDRAW) {
    return sendMessage(msg.chat.id,
      `❌ *Saque bloqueado*\n\nPrecisas de *${MIN_REFS_WITHDRAW}* referências.\nTens *${refs}*. Faltam *${MIN_REFS_WITHDRAW - refs}*.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  }
  setState(msg.from.id, { step: 'withdraw_amount' });
  await sendMessage(msg.chat.id,
    `💸 *Saque de TON*\n\nSaldo: *${(user.balance || 0).toFixed(4)} TON*\n\nEnvia o *valor* (ex: \`1.5\`):`,
    { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }
  );
}

async function handleTarefas(msg, page = 0) {
  const user = await getOrCreateUser(msg.from);
  const offset = page * TASKS_PER_PAGE;
  const { data: tasks, count, error } = await supabase
    .from('tasks')
    .select('id, title, task_type, reward, slots_remaining', { count: 'exact' })
    .eq('status', 'open').gt('slots_remaining', 0)
    .neq('advertiser_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + TASKS_PER_PAGE - 1);

  if (error) { console.error('[/tarefas]', error.message); return; }

  const showPromo = page === 0;
  const linhas = (tasks || []).map((t, i) =>
    `${offset + i + 1}. ${taskTypeEmoji(t.task_type)} *${t.title}*\n   💎 ${t.reward} TON · ${t.slots_remaining} vaga(s)`
  ).join('\n\n');
  const promoLine = showPromo
    ? `🌟 *[PROMO]* Make Real Money Just by Walking!\n   _Sem recompensa · Sweetcoin_\n\n` : '';

  if (!tasks?.length && !showPromo) {
    return sendMessage(msg.chat.id,
      `📋 *Tarefas Disponíveis*\n\nNenhuma tarefa aberta.\nVolta mais tarde!`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  }

  await sendMessage(msg.chat.id,
    `📋 *Tarefas Disponíveis* (${(count || 0) + (showPromo ? 1 : 0)} total)\n\n` +
    promoLine + (linhas || '_Sem tarefas regulares neste momento._') +
    `\n\n_Clica numa tarefa para ver detalhes:_`,
    { parse_mode: 'Markdown', reply_markup: KB.taskList(tasks || [], page, count || 0, showPromo) }
  );
}

async function handleCriar(msg) {
  const user = await getOrCreateUser(msg.from);
  if ((user.balance || 0) < 2) {
    return sendMessage(msg.chat.id,
      `❌ *Saldo insuficiente*\n\nTaxa mínima: *2 TON*\nSaldo: *${(user.balance||0).toFixed(4)} TON*\n\nDeposita com /depositar.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  }
  setState(msg.from.id, { step: 'create_type', userId: user.id });
  await sendMessage(msg.chat.id,
    `➕ *Criar Nova Tarefa*\n\nSaldo: *${(user.balance||0).toFixed(4)} TON*\n\n🏷 *Taxas de listagem:*\n📢 Canal — *2 TON*\n👥 Grupo — *2 TON*\n🤖 Bot — *2 TON*\n\nEscolhe o *tipo*:`,
    { parse_mode: 'Markdown', reply_markup: KB.taskTypes() }
  );
}

async function handleReferral(msg) {
  const user = await getOrCreateUser(msg.from);
  const link   = `https://t.me/${BOT_USERNAME}?start=r${msg.from.id}`;
  const refs   = user.referral_count || 0;
  const earned = (refs * REFERRAL_BONUS).toFixed(4);
  const prog   = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar    = '█'.repeat(prog) + '░'.repeat(10 - prog);

  const { data: top } = await supabase
    .from('users').select('username, first_name, referral_count')
    .order('referral_count', { ascending: false }).limit(5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const leaderboard = top?.length
    ? `\n\n🏆 *Top Referrers:*\n` + top.map((u, i) =>
        `${medals[i]} @${u.username || u.first_name || 'anónimo'} — *${u.referral_count}* refs`
      ).join('\n')
    : '';

  await sendMessage(msg.chat.id,
    `👥 *Programa de Referências*\n\n🔗 O teu link:\n\`${link}\`\n\n` +
    `${bar} *${Math.round((refs / MIN_REFS_WITHDRAW) * 100)}%*\n` +
    `📊 *${refs}/${MIN_REFS_WITHDRAW}* referências\n💎 *${earned} TON* ganhos` +
    leaderboard +
    `\n\n_Cada utilizador vale +${REFERRAL_BONUS} TON_\n_${MIN_REFS_WITHDRAW} refs para sacar_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Partilhar link', switch_inline_query: `Junta-te ao TaskMarket e ganha TON! ${link}` }],
          [{ text: '◀️ Menu Principal', callback_data: 'menu_main' }],
        ]
      }
    }
  );
}

async function handleMinhas(msg) {
  const user = await getOrCreateUser(msg.from);
  const [{ data: anunciante }, { data: executor }] = await Promise.all([
    supabase.from('tasks').select('id,title,status,reward').eq('advertiser_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('id,title,status,reward').eq('executor_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  let text = `📁 *As Minhas Tarefas*\n\n`;
  if (anunciante?.length) {
    text += `*Como Anunciante:*\n` +
      anunciante.map(t => `${statusEmoji(t.status)} [#${t.id}] ${t.title} — ${t.reward} TON`).join('\n') + '\n\n';
  }
  if (executor?.length) {
    text += `*Como Executor:*\n` +
      executor.map(t => `${statusEmoji(t.status)} [#${t.id}] ${t.title} — ${t.reward} TON`).join('\n');
  }
  if (!anunciante?.length && !executor?.length)
    text += `Ainda não participaste em nenhuma tarefa.\nUsa /tarefas para começar!`;
  await sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function handleAjuda(chatId) {
  await sendMessage(chatId,
    `🤖 *TaskMarket — Comandos*\n\n` +
    `/start     — Menu principal\n` +
    `/saldo     — Ver saldo e carteira\n` +
    `/depositar — Depositar TON via xRocket\n` +
    `/sacar     — Sacar TON\n` +
    `/tarefas   — Ver tarefas disponíveis\n` +
    `/criar     — Publicar nova tarefa\n` +
    `/minhas    — As tuas tarefas\n` +
    `/referral  — Link e leaderboard\n` +
    `/ajuda     — Este menu\n\n` +
    `💎 *Como funciona:*\n` +
    `• Executores completam tarefas e recebem TON\n` +
    `• Taxa de listagem: *2 TON* (canal, grupo ou bot)\n` +
    `• Saque com *${MIN_REFS_WITHDRAW}* referências`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PAINEL ADMIN
// ═══════════════════════════════════════════════════════════════════════

async function handleAdmin(msg) {
  if (msg.from.id !== ADMIN_ID) return sendMessage(msg.chat.id, '⛔ Acesso negado.');
  await sendMessage(msg.chat.id,
    `🔧 *Painel Admin TaskMarket*\n\nBem-vindo, administrador.`,
    { parse_mode: 'Markdown', reply_markup: KB.adminMenu() }
  );
}

async function adminStats(chatId) {
  const [
    { count: totalUsers },
    { count: totalTasks },
    { count: openTasks },
    { count: doneTasks },
    { count: disputedTasks },
    { data: volData },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
    supabase.from('transactions').select('amount').eq('type', 'deposit'),
  ]);
  const volume = (volData || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  await sendMessage(chatId,
    `📊 *Stats TaskMarket*\n\n` +
    `👥 Utilizadores: *${totalUsers || 0}*\n` +
    `📋 Tarefas: *${totalTasks || 0}* total\n` +
    `  🟡 Abertas: *${openTasks || 0}*\n` +
    `  ✅ Concluídas: *${doneTasks || 0}*\n` +
    `  ⚠️ Disputas: *${disputedTasks || 0}*\n\n` +
    `💰 Volume depósitos: *${volume.toFixed(4)} TON*`,
    { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() }
  );
}

async function adminTopUsers(chatId) {
  const { data: users } = await supabase
    .from('users').select('username,first_name,balance,referral_count,telegram_id')
    .order('balance', { ascending: false }).limit(10);
  if (!users?.length) return sendMessage(chatId, 'Sem utilizadores.', { reply_markup: KB.backToAdmin() });
  const lines = users.map((u, i) =>
    `${i+1}. @${u.username || u.first_name || 'anónimo'} (${u.telegram_id})\n` +
    `   💎 ${(u.balance||0).toFixed(4)} TON · 👥 ${u.referral_count||0} refs`
  ).join('\n\n');
  await sendMessage(chatId, `👥 *Top 10 por Saldo*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
}

async function adminDisputes(chatId) {
  const { data: tasks } = await supabase.from('tasks')
    .select('id,title,reward').eq('status', 'disputed')
    .order('updated_at', { ascending: false }).limit(10);
  if (!tasks?.length)
    return sendMessage(chatId, `⚠️ *Disputas*\n\nNenhuma disputa activa.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
  for (const task of tasks) {
    await sendMessage(chatId,
      `⚠️ *Disputa #${task.id}*\n\n*${task.title}*\n💎 ${task.reward} TON`,
      { parse_mode: 'Markdown', reply_markup: KB.disputeAdmin(task.id) });
  }
}

async function adminTasks(chatId) {
  const { data: tasks } = await supabase.from('tasks')
    .select('id,title,status,reward').order('created_at', { ascending: false }).limit(15);
  if (!tasks?.length) return sendMessage(chatId, 'Sem tarefas.', { reply_markup: KB.backToAdmin() });
  const lines = tasks.map(t =>
    `${statusEmoji(t.status)} [#${t.id}] *${t.title}* — ${t.reward} TON`).join('\n');
  await sendMessage(chatId, `📋 *Últimas 15 Tarefas*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
}

async function adminInvoices(chatId) {
  const { data: invoices } = await supabase.from('deposit_invoices')
    .select('invoice_id,amount,status,created_at').eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(10);
  if (!invoices?.length)
    return sendMessage(chatId, `💳 *Invoices Pendentes*\n\nNenhum.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
  const lines = invoices.map(inv => {
    const dt = new Date(inv.created_at).toLocaleString('pt-PT');
    return `• \`${inv.invoice_id.slice(0,16)}…\` — *${inv.amount} TON* (${dt})`;
  }).join('\n');
  await sendMessage(chatId, `💳 *Invoices Pendentes (${invoices.length})*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
}

async function adminStartBroadcast(chatId, fromId) {
  setState(fromId, { step: 'adm_broadcast' });
  await sendMessage(chatId,
    `📣 *Broadcast*\n\nEnvia a mensagem para *todos* os utilizadores (Markdown):`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'adm_menu' }]] } }
  );
}

async function executeBroadcast(chatId, fromId, text) {
  clearState(fromId);
  const { data: users } = await supabase.from('users').select('telegram_id');
  if (!users?.length) return sendMessage(chatId, '❌ Sem utilizadores.');
  let sent = 0, failed = 0;
  const progressMsg = await sendMessage(chatId, `📣 A enviar para ${users.length} utilizadores…`);
  for (const user of users) {
    try { await sendMessage(user.telegram_id, text, { parse_mode: 'Markdown' }); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 35)); // rate limit
  }
  await editMessage(chatId, progressMsg.result?.message_id,
    `📣 *Broadcast concluído*\n\n✅ Enviado: *${sent}*\n❌ Falhou: *${failed}*`,
    { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() }
  );
}

async function adminStartForceState(chatId, fromId) {
  setState(fromId, { step: 'adm_forcestate_id' });
  await sendMessage(chatId,
    `🔧 *Forçar Estado*\n\nEnvia o *ID* da tarefa:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'adm_menu' }]] } }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CALLBACK QUERIES
// ═══════════════════════════════════════════════════════════════════════

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId  = cb.message.message_id;
  const from   = cb.from;
  const data   = cb.data || '';

  await answerCallback(cb.id);

  // Menu principal
  if (data === 'menu_main')     return editMessage(chatId, msgId, `👋 *TaskMarket*\n\nO que queres fazer?`, { parse_mode: 'Markdown', reply_markup: KB.mainMenu() });
  if (data === 'menu_saldo')    return handleSaldo({ chat: { id: chatId }, from });
  if (data === 'menu_depositar')return handleDepositar({ chat: { id: chatId }, from });
  if (data === 'menu_sacar')    return handleSacar({ chat: { id: chatId }, from });
  if (data === 'menu_tarefas')  return handleTarefas({ chat: { id: chatId }, from });
  if (data === 'menu_criar')    return handleCriar({ chat: { id: chatId }, from });
  if (data === 'menu_referral') return handleReferral({ chat: { id: chatId }, from });
  if (data === 'menu_minhas')   return handleMinhas({ chat: { id: chatId }, from });
  if (data === 'menu_ajuda')    return handleAjuda(chatId);

  // Admin
  if (data === 'adm_menu') {
    if (from.id !== ADMIN_ID) return answerCallback(cb.id, '⛔ Sem permissão.', true);
    return editMessage(chatId, msgId, `🔧 *Painel Admin TaskMarket*`, { parse_mode: 'Markdown', reply_markup: KB.adminMenu() });
  }
  if (from.id === ADMIN_ID) {
    if (data === 'adm_stats')      return adminStats(chatId);
    if (data === 'adm_users')      return adminTopUsers(chatId);
    if (data === 'adm_disputes')   return adminDisputes(chatId);
    if (data === 'adm_tasks')      return adminTasks(chatId);
    if (data === 'adm_invoices')   return adminInvoices(chatId);
    if (data === 'adm_broadcast')  return adminStartBroadcast(chatId, from.id);
    if (data === 'adm_forcestate') return adminStartForceState(chatId, from.id);
  }

  // Depósito
  if (data.startsWith('dep_') && !data.startsWith('dep_check_') && data !== 'dep_cancel' && data !== 'dep_custom') {
    const amount = parseFloat(data.replace('dep_', ''));
    if (!isNaN(amount)) return startDepositFlow(chatId, from, amount);
  }
  if (data === 'dep_custom') {
    setState(from.id, { step: 'deposit_custom' });
    return sendMessage(chatId, `✏️ Envia o valor em TON (mínimo 0.1):`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'dep_cancel' }]] } });
  }
  if (data === 'dep_cancel') {
    clearState(from.id);
    return sendMessage(chatId, `❌ Depósito cancelado.`, { reply_markup: KB.backToMenu() });
  }
  if (data.startsWith('dep_check_')) {
    const invoiceId = data.replace('dep_check_', '');
    const status    = await getXRocketInvoiceStatus(invoiceId);
    if (status === 'paid')    return answerCallback(cb.id, '✅ Pagamento confirmado!', true);
    if (status === 'expired') { await answerCallback(cb.id, '⏱ Expirado. Cria um novo.', true); return editMarkup(chatId, msgId, KB.backToMenu()); }
    return answerCallback(cb.id, '⏳ Aguardando pagamento…', true);
  }

  // Tarefas
  if (data.startsWith('tasks_page_')) return handleTarefas({ chat: { id: chatId }, from }, parseInt(data.replace('tasks_page_', ''), 10));

  if (data === 'task_view_promo_sweetcoin') {
    return sendMessage(chatId,
      `🌟 *Make Real Money Just by Walking!*\n\n` +
      `Turn every step into rewards with Sweetcoin.\n\n` +
      `🔥 *Ultimate Challenge:*\n` +
      `Invite 20 friends and get $10 directly to your PayPal!\n` +
      `The more you walk and invite, the more you earn.\n\n` +
      `💡 _Promoção externa — sem recompensa em TON._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👉 Start now — Sweetcoin', url: 'https://swcapp.com/i/orlandojaime27142264868' }],
            [{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }],
          ]
        }
      }
    );
  }

  if (data.startsWith('task_view_'))    return showTaskDetail(chatId, from, data.replace('task_view_', ''));
  if (data.startsWith('task_accept_'))  return acceptTask(chatId, msgId, from, data.replace('task_accept_', ''), cb.id);
  if (data.startsWith('task_submit_'))  return submitTask(chatId, msgId, from, data.replace('task_submit_', ''));
  if (data.startsWith('task_approve_')) return approveTask(chatId, msgId, from, data.replace('task_approve_', ''));
  if (data.startsWith('task_dispute_')) return openDispute(chatId, msgId, from, data.replace('task_dispute_', ''));
  if (data.startsWith('task_cancel_'))  return cancelTask(chatId, msgId, from, data.replace('task_cancel_', ''));

  // Criar tarefa
  if (data.startsWith('create_type_')) {
    const type  = data.replace('create_type_', '');
    const state = getState(from.id);
    if (!state || state.step !== 'create_type') return;
    setState(from.id, { ...state, step: 'create_title', taskType: type });
    return sendMessage(chatId,
      `${taskTypeEmoji(type)} *${taskTypeLabel(type)}*\n\nEnvia o *título* (5–60 chars):`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'create_cancel' }]] } });
  }
  if (data === 'create_confirm') return confirmCreateTask(chatId, msgId, from);
  if (data === 'create_cancel')  { clearState(from.id); return sendMessage(chatId, '❌ Cancelado.', { reply_markup: KB.backToMenu() }); }

  // Saque
  if (data === 'withdraw_cancel')  { clearState(from.id); return sendMessage(chatId, '❌ Saque cancelado.', { reply_markup: KB.backToMenu() }); }
  if (data === 'withdraw_confirm') return handleWithdrawConfirm(cb);

  // Disputas
  if (data.startsWith('dispute_')) return handleDisputeCallback(cb, data);
}

// ═══════════════════════════════════════════════════════════════════════
// DEPOSIT FLOW
// ═══════════════════════════════════════════════════════════════════════

const pendingInvoices = new Map(); // invoiceId → { userId, telegramId, amount, chatId, msgId }

async function startDepositFlow(chatId, from, amount) {
  const user = await getOrCreateUser(from);

  const pendingMsg = await sendMessage(chatId, `⏳ A criar invoice para *${amount} TON*…`, { parse_mode: 'Markdown' });
  const invoice    = await createXRocketInvoice(amount);
  const mId        = pendingMsg.result?.message_id;

  if (!invoice) {
    return editMessage(chatId, mId, `❌ Erro ao criar invoice. Tenta novamente com /depositar.`);
  }

  await supabase.from('deposit_invoices').insert({
    user_id: user.id, invoice_id: invoice.id, amount, status: 'pending', created_at: new Date().toISOString(),
  }).catch(e => console.warn('[deposit] invoice insert:', e.message));

  pendingInvoices.set(invoice.id, { userId: user.id, telegramId: from.id, amount, chatId, msgId: mId });

  const expiry = new Date(Date.now() + 3600 * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  await editMessage(chatId, mId,
    `💰 *Invoice criado!*\n\nValor: *${amount} TON*\nID: \`${invoice.id}\`\nExpira às: *${expiry}*\n\nClica em Pagar — o saldo é creditado automaticamente.`,
    { parse_mode: 'Markdown', reply_markup: KB.depositPaying(invoice.id, invoice.link) }
  );

  startDepositPolling(chatId, mId, from.id, user.id, invoice.id, amount);
}

function startDepositPolling(chatId, msgId, telegramId, userId, invoiceId, amount) {
  let polls = 0;
  const timer = setInterval(async () => {
    polls++;
    if (polls > 450) { clearInterval(timer); pendingInvoices.delete(invoiceId); return; }
    try {
      const status = await getXRocketInvoiceStatus(invoiceId);
      if (status === 'paid') {
        clearInterval(timer);
        pendingInvoices.delete(invoiceId);
        const newBalance = await creditDepositIdempotent(userId, amount, invoiceId);
        if (newBalance === null) return;
        await editMessage(chatId, msgId,
          `✅ *Depósito confirmado!*\n\n*+${amount} TON* adicionado.\nNovo saldo: *${newBalance.toFixed(4)} TON*`,
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
        );
        console.log(`[deposit:poll] ✅ user=${userId} +${amount} TON`);
      } else if (status === 'expired') {
        clearInterval(timer);
        pendingInvoices.delete(invoiceId);
        await editMessage(chatId, msgId, `⏱ *Invoice expirado.*\n\nCria um novo com /depositar.`,
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
      }
    } catch (e) { console.error('[deposit:poll]', e.message); }
  }, 8000);
}

// ═══════════════════════════════════════════════════════════════════════
// TASK FLOWS
// ═══════════════════════════════════════════════════════════════════════

async function showTaskDetail(chatId, from, taskId) {
  const user = await getOrCreateUser(from);
  const { data: task } = await supabase.from('tasks')
    .select('*, advertiser:advertiser_id(username,first_name)').eq('id', taskId).single();
  if (!task) return sendMessage(chatId, '❌ Tarefa não encontrada.');
  const adv = task.advertiser;
  await sendMessage(chatId,
    `${taskTypeEmoji(task.task_type)} *${task.title}*\n\n` +
    `Tipo: *${taskTypeLabel(task.task_type)}*\n` +
    `Estado: *${statusEmoji(task.status)} ${statusLabel(task.status)}*\n` +
    `💎 Recompensa: *${task.reward} TON*\n` +
    `👤 Anunciante: @${adv?.username || adv?.first_name || 'anónimo'}\n` +
    `🎫 Vagas: *${task.slots_remaining}/${task.total_slots || 1}*\n\n` +
    (task.target_link ? `🔗 Link: ${task.target_link}\n\n` : '') +
    (task.description ? `📝 ${task.description}` : ''),
    { parse_mode: 'Markdown', reply_markup: KB.taskDetail(task, user.id) }
  );
}

async function acceptTask(chatId, msgId, from, taskId, cbId) {
  const user = await getUser(from.id);
  if (!user) return;
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!task || task.status !== 'open' || task.slots_remaining <= 0)
    return answerCallback(cbId, '❌ Tarefa indisponível.', true);
  if (task.advertiser_id === user.id)
    return answerCallback(cbId, '❌ Não podes aceitar a tua própria tarefa.', true);
  const { data: existing } = await supabase.from('task_slots').select('id')
    .eq('task_id', taskId).eq('executor_id', user.id).maybeSingle();
  if (existing) return answerCallback(cbId, '❌ Já aceitaste esta tarefa.', true);
  const { error } = await supabase.from('task_slots').insert({
    task_id: taskId, executor_id: user.id, status: 'in_progress', accepted_at: new Date().toISOString(),
  });
  if (error) return answerCallback(cbId, '❌ Erro ao aceitar.', true);
  const newSlots = task.slots_remaining - 1;
  await supabase.from('tasks').update({
    slots_remaining: newSlots, executor_id: user.id,
    status: newSlots === 0 ? 'in_progress' : task.status,
  }).eq('id', taskId);
  const { data: adv } = await supabase.from('users').select('telegram_id').eq('id', task.advertiser_id).single();
  if (adv) await sendMessage(adv.telegram_id,
    `📋 *Tarefa aceite!*\n"${task.title}"\n👤 @${from.username || from.first_name}\n💎 ${task.reward} TON em escrow.`,
    { parse_mode: 'Markdown' });
  await sendMessage(chatId,
    `✅ *Tarefa aceite!*\n\n"${task.title}"\n\n` +
    (task.target_link ? `🔗 Completa aqui:\n${task.target_link}\n\n` : '') +
    `Quando terminares usa /minhas para submeter.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function submitTask(chatId, msgId, from, taskId) {
  const user = await getUser(from.id);
  if (!user) return;
  await supabase.from('tasks').update({ status: 'pending_review' })
    .eq('id', taskId).eq('executor_id', user.id);
  const { data: task } = await supabase.from('tasks').select('title,reward,advertiser_id').eq('id', taskId).single();
  if (task) {
    const { data: adv } = await supabase.from('users').select('telegram_id').eq('id', task.advertiser_id).single();
    if (adv) await sendMessage(adv.telegram_id,
      `🟠 *Submetido para revisão!*\n"${task.title}"\n👤 @${from.username || from.first_name}\n\nUsa /minhas para aprovar.`,
      { parse_mode: 'Markdown' });
  }
  await editMessage(chatId, msgId, `📤 *Submetido!*\n\nAnunciante notificado. Aguarda aprovação.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function approveTask(chatId, msgId, from, taskId) {
  const user = await getUser(from.id);
  if (!user) return;
  const { data: task } = await supabase.from('tasks')
    .select('*, executor:executor_id(id,telegram_id,username,first_name)').eq('id', taskId).single();
  if (!task || task.advertiser_id !== user.id || task.status !== 'pending_review') return;
  const exec = task.executor;
  const { error } = await supabase.rpc('pay_executor', {
    p_task_id: taskId, p_executor_id: task.executor_id, p_amount: task.reward,
  });
  if (error) { console.error('[approveTask]', error.message); return sendMessage(chatId, '❌ Erro ao processar.'); }
  await logTx(exec.id, 'receipt', task.reward, `Tarefa aprovada #${taskId}`);
  if (exec.telegram_id) await sendMessage(exec.telegram_id,
    `✅ *Pagamento recebido!*\n"${task.title}"\n💎 *+${task.reward} TON* na tua carteira!`,
    { parse_mode: 'Markdown' });
  await editMessage(chatId, msgId,
    `✅ *Aprovado!*\n*${task.reward} TON* enviados para @${exec?.username || exec?.first_name || 'executor'}.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function openDispute(chatId, msgId, from, taskId) {
  const user = await getUser(from.id);
  if (!user) return;
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!task || task.advertiser_id !== user.id) return;
  await supabase.from('tasks').update({ status: 'disputed' }).eq('id', taskId);
  await sendMessage(ADMIN_ID,
    `⚠️ *Nova disputa*\n\n*${task.title}* (#${taskId})\nReportado por: @${from.username || from.first_name}\nRecompensa: *${task.reward} TON*`,
    { parse_mode: 'Markdown', reply_markup: KB.disputeAdmin(taskId) });
  await editMessage(chatId, msgId, `⚠️ *Disputa aberta.*\n\nO admin foi notificado.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function cancelTask(chatId, msgId, from, taskId) {
  const user = await getUser(from.id);
  if (!user) return;
  const { data: task } = await supabase.from('tasks').select('*')
    .eq('id', taskId).eq('advertiser_id', user.id).eq('status', 'open').single();
  if (!task) {
    return sendMessage(chatId,
      `❌ Só podes cancelar tarefas *abertas* que publicaste.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
  }
  const refund = parseFloat((task.reward * task.slots_remaining).toFixed(6));
  await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId);
  if (refund > 0) {
    await creditUser(user.id, refund);
    await logTx(user.id, 'refund', refund, `Tarefa cancelada #${taskId}`);
  }
  await editMessage(chatId, msgId,
    `✅ *Tarefa cancelada.*\n\n💎 *+${refund.toFixed(4)} TON* reembolsado.\n_(Taxa de ${LISTING_FEE} TON não reembolsada.)_`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

// ═══════════════════════════════════════════════════════════════════════
// CREATE TASK FSM
// ═══════════════════════════════════════════════════════════════════════

async function handleCreateFSM(msg) {
  const state = getState(msg.from.id);
  if (!state || !state.step?.startsWith('create_')) return false;
  const chatId   = msg.chat.id;
  const text     = (msg.text || '').trim();
  const cancelKb = { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'create_cancel' }]] };

  switch (state.step) {
    case 'create_title': {
      if (text.length < 5 || text.length > 60) {
        await sendMessage(chatId, '❌ Título deve ter 5–60 caracteres:', { reply_markup: cancelKb }); return true;
      }
      setState(msg.from.id, { ...state, step: 'create_link', title: text });
      await sendMessage(chatId, `✅ Título: *${text}*\n\nEnvia o *link* (URL ou @username):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_link': {
      if (!text.startsWith('http') && !text.startsWith('t.me') && !text.startsWith('@')) {
        await sendMessage(chatId, '❌ Link inválido. Envia URL ou @username:', { reply_markup: cancelKb }); return true;
      }
      setState(msg.from.id, { ...state, step: 'create_reward', targetLink: text });
      await sendMessage(chatId, `✅ Link: \`${text}\`\n\nEnvia a *recompensa por executor* em TON (ex: \`0.5\`):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_reward': {
      const reward = parseFloat(text);
      if (isNaN(reward) || reward < 0.01) {
        await sendMessage(chatId, '❌ Valor inválido. Mínimo 0.01 TON:', { reply_markup: cancelKb }); return true;
      }
      setState(msg.from.id, { ...state, step: 'create_slots', reward });
      await sendMessage(chatId, `✅ Recompensa: *${reward} TON* por executor\n\nQuantos executores? (1–100):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_slots': {
      const slots = parseInt(text, 10);
      if (isNaN(slots) || slots < 1 || slots > 100) {
        await sendMessage(chatId, '❌ Número inválido. Entre 1 e 100:', { reply_markup: cancelKb }); return true;
      }
      const user      = await getUser(msg.from.id);
      const listingFee = LISTING_FEES[state.taskType] || 2;
      const totalCost = parseFloat((state.reward * slots + listingFee).toFixed(6));
      const saldo     = user?.balance || 0;
      setState(msg.from.id, { ...state, step: 'create_confirm', slots, totalCost, listingFee });
      if (saldo < totalCost) {
        clearState(msg.from.id);
        await sendMessage(chatId,
          `❌ *Saldo insuficiente*\n\nCusto: *${totalCost} TON*\nSaldo: *${saldo.toFixed(4)} TON*\n\nDeposita com /depositar.`,
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }); return true;
      }
      await sendMessage(chatId,
        `📋 *Confirma a tarefa*\n\n` +
        `${taskTypeEmoji(state.taskType)} *${taskTypeLabel(state.taskType)}*\n` +
        `📌 *${state.title}*\n🔗 \`${state.targetLink}\`\n` +
        `💎 ${state.reward} TON × ${slots}\n🏷 Taxa: ${listingFee} TON\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💳 Total: *${totalCost} TON*\n💰 Após: *${(saldo - totalCost).toFixed(4)} TON*`,
        { parse_mode: 'Markdown', reply_markup: KB.createConfirm() });
      return true;
    }
  }
  return false;
}

async function confirmCreateTask(chatId, msgId, from) {
  const state = getState(from.id);
  if (!state || state.step !== 'create_confirm') return;
  const user = await getUser(from.id);
  if (!user) return;
  try { await debitUser(user.id, state.totalCost); }
  catch { return sendMessage(chatId, '❌ Saldo insuficiente.', { reply_markup: KB.backToMenu() }); }
  const { data: task, error } = await supabase.from('tasks').insert({
    advertiser_id: user.id, task_type: state.taskType, title: state.title,
    target_link: state.targetLink, reward: state.reward,
    total_slots: state.slots, slots_remaining: state.slots,
    status: 'open', created_at: new Date().toISOString(),
  }).select().single();
  if (error) {
    await creditUser(user.id, state.totalCost);
    console.error('[createTask]', error.message);
    return sendMessage(chatId, '❌ Erro ao criar. Saldo reembolsado.');
  }
  await logTx(user.id, 'payment', -state.totalCost, `Tarefa publicada #${task.id}`);
  clearState(from.id);
  await editMessage(chatId, msgId,
    `✅ *Tarefa publicada!*\n\n#${task.id} — ${task.title}\n💎 ${state.reward} TON × ${state.slots}\n\nJá visível em /tarefas.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
  await sendMessage(ADMIN_ID,
    `📢 *Nova tarefa*\n#${task.id} — ${task.title}\nAnunciante: @${from.username||from.first_name}\n${state.reward} TON × ${state.slots}`,
    { parse_mode: 'Markdown' });
}

// ═══════════════════════════════════════════════════════════════════════
// WITHDRAW FSM
// ═══════════════════════════════════════════════════════════════════════

async function handleWithdrawFSM(msg) {
  const state = getState(msg.from.id);
  if (!state || !state.step?.startsWith('withdraw_')) return false;
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  if (state.step === 'withdraw_amount') {
    const amount = parseFloat(text);
    const user   = await getUser(msg.from.id);
    const saldo  = user?.balance || 0;
    if (isNaN(amount) || amount < 0.01) {
      await sendMessage(chatId, '❌ Valor inválido. Mínimo 0.01 TON:', { reply_markup: KB.withdrawCancel() }); return true;
    }
    if (amount > saldo) {
      await sendMessage(chatId, `❌ Saldo insuficiente. Tens *${saldo.toFixed(4)} TON*.`,
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }); return true;
    }
    setState(msg.from.id, { step: 'withdraw_address', amount });
    await sendMessage(chatId, `✅ Valor: *${amount} TON*\n\nEnvia o *endereço TON*:`,
      { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() });
    return true;
  }

  if (state.step === 'withdraw_address') {
    const valid = /^(UQ|EQ|0:)[A-Za-z0-9_\-]{40,}$/.test(text);
    if (!valid) {
      await sendMessage(chatId, '❌ Endereço inválido.\nFormato: `UQA…` ou `EQB…`',
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }); return true;
    }
    setState(msg.from.id, { step: 'withdraw_confirm', amount: state.amount, address: text });
    await sendMessage(chatId,
      `💸 *Confirma o saque*\n\nValor: *${state.amount} TON*\nPara: \`${text}\`\n\n⚠️ Irreversível.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Confirmar', callback_data: 'withdraw_confirm' }],
            [{ text: '❌ Cancelar',  callback_data: 'withdraw_cancel'  }],
          ]
        }
      });
    return true;
  }
  return false;
}

async function handleWithdrawConfirm(cb) {
  const chatId = cb.message.chat.id;
  const msgId  = cb.message.message_id;
  const from   = cb.from;
  const state  = getState(from.id);
  if (!state || state.step !== 'withdraw_confirm') return;
  await answerCallback(cb.id);
  await editMessage(chatId, msgId, `⏳ A processar…`);
  const user = await getUser(from.id);
  try { await debitUser(user.id, state.amount); }
  catch { clearState(from.id); return editMessage(chatId, msgId, '❌ Saldo insuficiente.'); }
  const result = await sendXRocketTransfer(state.address, state.amount);
  if (!result) {
    await creditUser(user.id, state.amount);
    clearState(from.id);
    return editMessage(chatId, msgId, '❌ Erro no xRocket. Saldo reembolsado.\nTenta com /sacar.');
  }
  await logTx(user.id, 'withdrawal', -state.amount, `Saque para ${state.address}`);
  clearState(from.id);
  await editMessage(chatId, msgId,
    `✅ *Saque processado!*\n\n*${state.amount} TON* enviados para:\n\`${state.address}\``,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

// ═══════════════════════════════════════════════════════════════════════
// ADMIN FSM
// ═══════════════════════════════════════════════════════════════════════

async function handleAdminFSM(msg) {
  if (msg.from.id !== ADMIN_ID) return false;
  const state = getState(msg.from.id);
  if (!state || !state.step?.startsWith('adm_')) return false;
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  if (state.step === 'adm_broadcast') {
    await executeBroadcast(chatId, msg.from.id, text); return true;
  }
  if (state.step === 'adm_forcestate_id') {
    const taskId = parseInt(text, 10);
    if (isNaN(taskId)) { await sendMessage(chatId, '❌ ID inválido:'); return true; }
    const { data: task } = await supabase.from('tasks').select('id,title,status').eq('id', taskId).single();
    if (!task) { await sendMessage(chatId, `❌ Tarefa #${taskId} não encontrada.`); return true; }
    setState(msg.from.id, { step: 'adm_forcestate_status', taskId, taskTitle: task.title });
    await sendMessage(chatId,
      `Tarefa: *${task.title}*\nEstado actual: *${task.status}*\n\nNovo estado:\n\`open\` | \`in_progress\` | \`pending_review\` | \`done\` | \`cancelled\` | \`disputed\``,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'adm_menu' }]] } });
    return true;
  }
  if (state.step === 'adm_forcestate_status') {
    const valid = ['open','in_progress','pending_review','done','cancelled','disputed'];
    if (!valid.includes(text)) { await sendMessage(chatId, `❌ Estado inválido. Opções: ${valid.join(', ')}`); return true; }
    await supabase.from('tasks').update({ status: text }).eq('id', state.taskId);
    clearState(msg.from.id);
    await sendMessage(chatId, `✅ Tarefa #${state.taskId} → *${text}*`,
      { parse_mode: 'Markdown', reply_markup: KB.backToAdmin() });
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// DEPOSIT CUSTOM FSM
// ═══════════════════════════════════════════════════════════════════════

async function handleDepositCustomFSM(msg) {
  const state = getState(msg.from.id);
  if (!state || state.step !== 'deposit_custom') return false;
  const amount = parseFloat((msg.text || '').trim());
  if (isNaN(amount) || amount < 0.1) {
    await sendMessage(msg.chat.id, '❌ Valor inválido. Mínimo 0.1 TON:',
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'dep_cancel' }]] } });
    return true;
  }
  clearState(msg.from.id);
  await startDepositFlow(msg.chat.id, msg.from, amount);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// DISPUTE ADMIN CALLBACKS
// ═══════════════════════════════════════════════════════════════════════

async function handleDisputeCallback(cb, data) {
  const chatId = cb.message.chat.id;
  const msgId  = cb.message.message_id;
  if (cb.from.id !== ADMIN_ID) return answerCallback(cb.id, '⛔ Sem permissão.', true);
  const [, action, taskId] = data.split('_');
  const { data: task } = await supabase.from('tasks')
    .select('*, advertiser:advertiser_id(id,telegram_id), executor:executor_id(id,telegram_id)')
    .eq('id', taskId).single();
  if (!task) return answerCallback(cb.id, '❌ Tarefa não encontrada.', true);

  if (action === 'accept' && task.executor) {
    await creditUser(task.executor.id, task.reward);
    await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId);
    await logTx(task.executor.id, 'receipt', task.reward, `Disputa aceite #${taskId}`);
    await sendMessage(task.executor.telegram_id,
      `✅ *Disputa a teu favor!*\n#${taskId}\n💎 *+${task.reward} TON*!`, { parse_mode: 'Markdown' });
    await editMessage(chatId, msgId, `✅ Disputa #${taskId} — executor pago (${task.reward} TON).`);
  } else if (action === 'reject' && task.advertiser) {
    await creditUser(task.advertiser.id, task.reward);
    await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId);
    await logTx(task.advertiser.id, 'refund', task.reward, `Disputa rejeitada #${taskId}`);
    await sendMessage(task.advertiser.telegram_id,
      `❌ *Disputa #${taskId} rejeitada.*\n💎 *+${task.reward} TON* devolvido.`, { parse_mode: 'Markdown' });
    await editMessage(chatId, msgId, `❌ Disputa #${taskId} — anunciante reembolsado (${task.reward} TON).`);
  }
  await answerCallback(cb.id, '✅ Processado.');
}

// ═══════════════════════════════════════════════════════════════════════
// REALTIME
// ═══════════════════════════════════════════════════════════════════════

function setupRealtimeSubscriptions() {
  supabase.channel('tasks-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, async payload => {
      const task = payload.new, old = payload.old;
      if (old.status === 'open' && task.status === 'in_progress' && task.executor_id) {
        const [exec, adv] = await Promise.all([
          supabase.from('users').select('username,first_name').eq('id', task.executor_id).maybeSingle().then(r => r.data),
          supabase.from('users').select('telegram_id').eq('id', task.advertiser_id).maybeSingle().then(r => r.data),
        ]);
        if (exec && adv) await sendMessage(adv.telegram_id,
          `📋 *Aceite!*\n"${task.title}"\n👤 @${exec.username||exec.first_name}\n💎 ${task.reward} TON em escrow.`,
          { parse_mode: 'Markdown' });
      }
      if (['in_progress','pending_review'].includes(old.status) && task.status === 'done' && task.executor_id) {
        const exec = await supabase.from('users').select('telegram_id').eq('id', task.executor_id).maybeSingle().then(r => r.data);
        if (exec) await sendMessage(exec.telegram_id,
          `✅ *Pago!*\n"${task.title}"\n💎 *+${task.reward} TON*!`, { parse_mode: 'Markdown' });
      }
    })
    .subscribe(s => console.log(`[realtime:tasks] ${s}`));

  supabase.channel('transactions-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, async payload => {
      const tx = payload.new;
      if (tx.type !== 'deposit') return;
      const user = await supabase.from('users').select('telegram_id').eq('id', tx.user_id).maybeSingle().then(r => r.data);
      if (user) await sendMessage(user.telegram_id,
        `💰 *Depósito confirmado!*\n*+${tx.amount} TON* adicionado.`, { parse_mode: 'Markdown' });
    })
    .subscribe(s => console.log(`[realtime:transactions] ${s}`));

  console.log('[realtime] ✅ activo: tasks, transactions');
}

// ═══════════════════════════════════════════════════════════════════════
// JOB — REMINDER 24H
// ═══════════════════════════════════════════════════════════════════════

async function runPendingReviewReminders() {
  try {
    const cutoff = new Date(Date.now() - PENDING_REVIEW_TTL_MS).toISOString();
    const { data: tasks } = await supabase.from('tasks')
      .select('id,title,reward,advertiser_id').eq('status', 'pending_review').lt('updated_at', cutoff);
    if (!tasks?.length) return;
    for (const task of tasks) {
      const adv = await supabase.from('users').select('telegram_id').eq('id', task.advertiser_id).single().then(r => r.data);
      if (!adv) continue;
      await sendMessage(adv.telegram_id,
        `⏰ *Lembrete: revisão pendente há 24h+*\n\n"${task.title}" (#${task.id})\n💎 ${task.reward} TON\n\nUsa /minhas para aprovar ou disputar.`,
        { parse_mode: 'Markdown' });
      console.log(`[reminder] tarefa #${task.id} → ${adv.telegram_id}`);
    }
  } catch (e) { console.error('[reminder]', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════════════

async function processUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const cmd = (msg.text || '').trim().split(/[\s@]/)[0].toLowerCase();

    if (cmd !== '/start' && cmd !== '/ajuda' && cmd !== '/help') {
      if (await handleAdminFSM(msg))         return;
      if (await handleDepositCustomFSM(msg)) return;
      if (await handleWithdrawFSM(msg))      return;
      if (await handleCreateFSM(msg))        return;
    }

    switch (cmd) {
      case '/start':     return handleStart(msg);
      case '/saldo':     return handleSaldo(msg);
      case '/depositar': return handleDepositar(msg);
      case '/sacar':     return handleSacar(msg);
      case '/tarefas':   return handleTarefas(msg);
      case '/criar':     return handleCriar(msg);
      case '/referral':
      case '/ref':       return handleReferral(msg);
      case '/minhas':    return handleMinhas(msg);
      case '/admin':     return handleAdmin(msg);
      case '/ajuda':
      case '/help':      return handleAjuda(msg.chat.id);
      default:
        if (cmd.startsWith('/'))
          await sendMessage(msg.chat.id, '❓ Comando desconhecido. Usa /ajuda.',
            { reply_markup: KB.backToMenu() });
    }
    return;
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    if (cb.data === 'withdraw_confirm') return handleWithdrawConfirm(cb);
    return handleCallback(cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SERVIDOR HTTP
// ═══════════════════════════════════════════════════════════════════════

http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TaskMarket OK');
    return;
  }
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', async () => {

    // Webhook Telegram
    if (req.url === WEBHOOK_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      try { await processUpdate(JSON.parse(body)); }
      catch (e) { console.error('[webhook:tg]', e.message); }
      return;
    }

    // Webhook xRocket
    if (req.url === XROCKET_WEBHOOK_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      try {
        const payload   = JSON.parse(body);
        const invoiceId = payload.invoiceId || payload.invoice_id;
        const status    = payload.status;

        if (status === 'paid' && invoiceId) {
          const inv = pendingInvoices.get(invoiceId);
          if (inv) {
            pendingInvoices.delete(invoiceId);
            const newBalance = await creditDepositIdempotent(inv.userId, inv.amount, invoiceId);
            if (newBalance !== null) {
              await editMessage(inv.chatId, inv.msgId,
                `✅ *Depósito confirmado!*\n\n*+${inv.amount} TON*\nNovo saldo: *${newBalance.toFixed(4)} TON*`,
                { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
              console.log(`[xrocket:webhook] ✅ user=${inv.userId} +${inv.amount} TON`);
            }
          } else {
            // Restart do servidor — lookup na BD
            const { data: dbInv } = await supabase.from('deposit_invoices')
              .select('user_id,amount').eq('invoice_id', invoiceId).maybeSingle();
            if (dbInv) {
              const newBalance = await creditDepositIdempotent(dbInv.user_id, dbInv.amount, invoiceId);
              if (newBalance !== null) {
                const user = await getUserById(dbInv.user_id);
                if (user) await sendMessage(user.telegram_id,
                  `✅ *Depósito confirmado!*\n*+${dbInv.amount} TON*\nSaldo: *${newBalance.toFixed(4)} TON*`,
                  { parse_mode: 'Markdown' });
              }
            }
          }
        }
      } catch (e) { console.error('[webhook:xrocket]', e.message); }
      return;
    }

    res.writeHead(404);
    res.end();
  });

}).listen(PORT, async () => {
  console.log(`\n✅ TaskMarket Bot na porta ${PORT}`);
  console.log(`   Webhook Telegram : ${WEBHOOK_PATH}`);
  console.log(`   Webhook xRocket  : ${XROCKET_WEBHOOK_PATH}\n`);

  if (!RENDER_URL) {
    console.warn('⚠️  RENDER_EXTERNAL_URL não definido — webhook não registado');
  } else {
    const webhookUrl = `${RENDER_URL}${WEBHOOK_PATH}`;
    try {
      const r = await tgCall('setWebhook', { url: webhookUrl, drop_pending_updates: true });
      if (r.ok) console.log(`✅ Webhook: ${webhookUrl}`);
      else      console.error(`❌ Webhook falhou: ${r.description}`);
    } catch (e) { console.error('[webhook]', e.message); }
  }

  setInterval(runPendingReviewReminders, REMINDER_INTERVAL_MS);
  setInterval(sweepExpiredStates, 10 * 60 * 1000);
  console.log('⏱ Jobs: reminder 24h ✅  sweep FSM ✅');

  setupRealtimeSubscriptions();
});

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

// ═══════════════════════════════════════════════════════════════════════
// i18n — INTERNACIONALIZAÇÃO EMBUTIDA (13 idiomas)
// Detecta automaticamente via from.language_code do Telegram
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// i18n.js — Internacionalização do TaskMarket Bot
//
// Detecta o idioma do dispositivo via from.language_code (campo nativo
// do Telegram — preenchido automaticamente pelo cliente do utilizador).
//
// Idiomas suportados:
//   pt  — Português (fallback padrão)
//   en  — English
//   es  — Español
//   fr  — Français
//   de  — Deutsch
//   it  — Italiano
//   ru  — Русский
//   uk  — Українська
//   ar  — العربية
//   zh  — 中文
//   hi  — हिन्दी
//   tr  — Türkçe
//   id  — Bahasa Indonesia
//
// Uso:
//   const { t, lang } = require('./i18n');
//   const locale = lang(from);          // detecta idioma do utilizador
//   t(locale, 'welcome_new', { nome })  // traduz com substituição de variáveis
// ═══════════════════════════════════════════════════════════════════════

// ── Mapeamento de códigos de idioma Telegram → locale interno ─────────
// O Telegram envia tags BCP-47 (ex: "pt-br", "zh-hans", "en-us").
// Normalizamos para o código base de 2 letras.
const LANG_MAP = {
  pt: 'pt', 'pt-br': 'pt', 'pt-pt': 'pt',
  en: 'en', 'en-us': 'en', 'en-gb': 'en',
  es: 'es', 'es-419': 'es',
  fr: 'fr', 'fr-be': 'fr', 'fr-ca': 'fr',
  de: 'de', 'de-at': 'de', 'de-ch': 'de',
  it: 'it',
  ru: 'ru',
  uk: 'uk',
  ar: 'ar', 'ar-sa': 'ar', 'ar-eg': 'ar',
  zh: 'zh', 'zh-hans': 'zh', 'zh-hant': 'zh', 'zh-cn': 'zh', 'zh-tw': 'zh',
  hi: 'hi',
  tr: 'tr',
  id: 'id',
};

const DEFAULT_LANG = 'pt';

// ── Strings por chave e idioma ────────────────────────────────────────
// Variáveis dinâmicas: {nome}, {bonus}, {minRefs}, {refs}, {saldo}, etc.
// Usar a mesma chave em todos os idiomas.

const STRINGS = {

  // ── Boas-vindas ──────────────────────────────────────────────────────

  welcome_new: {
    pt: `👋 Bem-vindo ao *TaskMarket*, {nome}!\n\n📋 Completa tarefas e ganha *TON*\n➕ Publica tarefas e paga executores\n👥 *+{bonus} TON* por cada referência\n💎 {minRefs} referências para sacar\n\nEscolhe uma opção:`,
    en: `👋 Welcome to *TaskMarket*, {nome}!\n\n📋 Complete tasks and earn *TON*\n➕ Post tasks and pay executors\n👥 *+{bonus} TON* per referral\n💎 {minRefs} referrals to withdraw\n\nChoose an option:`,
    es: `👋 ¡Bienvenido a *TaskMarket*, {nome}!\n\n📋 Completa tareas y gana *TON*\n➕ Publica tareas y paga ejecutores\n👥 *+{bonus} TON* por referido\n💎 {minRefs} referidos para retirar\n\nElige una opción:`,
    fr: `👋 Bienvenue sur *TaskMarket*, {nome}!\n\n📋 Complète des tâches et gagne des *TON*\n➕ Publie des tâches et paye des exécuteurs\n👥 *+{bonus} TON* par parrainage\n💎 {minRefs} parrainages pour retirer\n\nChoisis une option :`,
    de: `👋 Willkommen bei *TaskMarket*, {nome}!\n\n📋 Erledige Aufgaben und verdiene *TON*\n➕ Veröffentliche Aufgaben und bezahle Ausführer\n👥 *+{bonus} TON* pro Empfehlung\n💎 {minRefs} Empfehlungen zum Auszahlen\n\nWähle eine Option:`,
    it: `👋 Benvenuto su *TaskMarket*, {nome}!\n\n📋 Completa attività e guadagna *TON*\n➕ Pubblica attività e paga esecutori\n👥 *+{bonus} TON* per ogni riferimento\n💎 {minRefs} riferimenti per prelevare\n\nScegli un'opzione:`,
    ru: `👋 Добро пожаловать в *TaskMarket*, {nome}!\n\n📋 Выполняй задания и зарабатывай *TON*\n➕ Публикуй задания и плати исполнителям\n👥 *+{bonus} TON* за каждого реферала\n💎 {minRefs} рефералов для вывода\n\nВыбери опцию:`,
    uk: `👋 Ласкаво просимо до *TaskMarket*, {nome}!\n\n📋 Виконуй завдання та заробляй *TON*\n➕ Публікуй завдання та плати виконавцям\n👥 *+{bonus} TON* за кожного реферала\n💎 {minRefs} рефералів для виведення\n\nОбери опцію:`,
    ar: `👋 مرحباً بك في *TaskMarket*، {nome}!\n\n📋 أكمل المهام واكسب *TON*\n➕ انشر المهام وادفع للمنفذين\n👥 *+{bonus} TON* لكل إحالة\n💎 {minRefs} إحالات للسحب\n\nاختر خياراً:`,
    zh: `👋 欢迎来到 *TaskMarket*，{nome}！\n\n📋 完成任务赚取 *TON*\n➕ 发布任务并支付执行者\n👥 每次推荐 *+{bonus} TON*\n💎 需 {minRefs} 次推荐才能提现\n\n选择一个选项：`,
    hi: `👋 *TaskMarket* में आपका स्वागत है, {nome}!\n\n📋 कार्य पूरा करें और *TON* कमाएं\n➕ कार्य पोस्ट करें और एक्जीक्यूटर को भुगतान करें\n👥 प्रत्येक रेफरल पर *+{bonus} TON*\n💎 निकासी के लिए {minRefs} रेफरल\n\nएक विकल्प चुनें:`,
    tr: `👋 *TaskMarket*'e hoş geldin, {nome}!\n\n📋 Görevleri tamamla ve *TON* kazan\n➕ Görev yayınla ve uygulayıcılara öde\n👥 Her yönlendirme için *+{bonus} TON*\n💎 Çekim için {minRefs} yönlendirme\n\nBir seçenek seç:`,
    id: `👋 Selamat datang di *TaskMarket*, {nome}!\n\n📋 Selesaikan tugas dan dapatkan *TON*\n➕ Posting tugas dan bayar eksekutor\n👥 *+{bonus} TON* per referral\n💎 {minRefs} referral untuk withdraw\n\nPilih opsi:`,
  },

  welcome_back: {
    pt: `👋 Olá de novo, *{nome}*!\n\nO que queres fazer?`,
    en: `👋 Welcome back, *{nome}*!\n\nWhat would you like to do?`,
    es: `👋 ¡Hola de nuevo, *{nome}*!\n\n¿Qué quieres hacer?`,
    fr: `👋 Re-bonjour, *{nome}*!\n\nQue souhaites-tu faire ?`,
    de: `👋 Willkommen zurück, *{nome}*!\n\nWas möchtest du tun?`,
    it: `👋 Bentornato, *{nome}*!\n\nCosa vuoi fare?`,
    ru: `👋 С возвращением, *{nome}*!\n\nЧто хочешь сделать?`,
    uk: `👋 З поверненням, *{nome}*!\n\nЩо хочеш зробити?`,
    ar: `👋 أهلاً مجدداً، *{nome}*!\n\nماذا تريد أن تفعل؟`,
    zh: `👋 欢迎回来，*{nome}*！\n\n你想做什么？`,
    hi: `👋 फिर से स्वागत है, *{nome}*!\n\nआप क्या करना चाहते हैं?`,
    tr: `👋 Tekrar hoş geldin, *{nome}*!\n\nNe yapmak istiyorsun?`,
    id: `👋 Selamat datang kembali, *{nome}*!\n\nMau ngapain?`,
  },

  // /inicio
  inicio_menu: {
    pt: `👋 Olá, *{nome}*!\n\nO que queres fazer?`,
    en: `👋 Hello, *{nome}*!\n\nWhat would you like to do?`,
    es: `👋 ¡Hola, *{nome}*!\n\n¿Qué quieres hacer?`,
    fr: `👋 Bonjour, *{nome}*!\n\nQue souhaites-tu faire ?`,
    de: `👋 Hallo, *{nome}*!\n\nWas möchtest du tun?`,
    it: `👋 Ciao, *{nome}*!\n\nCosa vuoi fare?`,
    ru: `👋 Привет, *{nome}*!\n\nЧто хочешь сделать?`,
    uk: `👋 Привіт, *{nome}*!\n\nЩо хочеш зробити?`,
    ar: `👋 مرحباً، *{nome}*!\n\nماذا تريد أن تفعل؟`,
    zh: `👋 你好，*{nome}*！\n\n你想做什么？`,
    hi: `👋 नमस्ते, *{nome}*!\n\nआप क्या करना चाहते हैं?`,
    tr: `👋 Merhaba, *{nome}*!\n\nNe yapmak istiyorsun?`,
    id: `👋 Halo, *{nome}*!\n\nMau ngapain?`,
  },

  account_created: {
    pt: `✅ *Conta criada!*\n\n📋 Completa tarefas e ganha *TON*\n👥 *+{bonus} TON* por cada referência\n💎 {minRefs} referências para sacar`,
    en: `✅ *Account created!*\n\n📋 Complete tasks and earn *TON*\n👥 *+{bonus} TON* per referral\n💎 {minRefs} referrals to withdraw`,
    es: `✅ *¡Cuenta creada!*\n\n📋 Completa tareas y gana *TON*\n👥 *+{bonus} TON* por referido\n💎 {minRefs} referidos para retirar`,
    fr: `✅ *Compte créé !*\n\n📋 Complète des tâches et gagne des *TON*\n👥 *+{bonus} TON* par parrainage\n💎 {minRefs} parrainages pour retirer`,
    de: `✅ *Konto erstellt!*\n\n📋 Erledige Aufgaben und verdiene *TON*\n👥 *+{bonus} TON* pro Empfehlung\n💎 {minRefs} Empfehlungen zum Auszahlen`,
    it: `✅ *Account creato!*\n\n📋 Completa attività e guadagna *TON*\n👥 *+{bonus} TON* per riferimento\n💎 {minRefs} riferimenti per prelevare`,
    ru: `✅ *Аккаунт создан!*\n\n📋 Выполняй задания и зарабатывай *TON*\n👥 *+{bonus} TON* за реферала\n💎 {minRefs} рефералов для вывода`,
    uk: `✅ *Акаунт створено!*\n\n📋 Виконуй завдання та заробляй *TON*\n👥 *+{bonus} TON* за реферала\n💎 {minRefs} рефералів для виведення`,
    ar: `✅ *تم إنشاء الحساب!*\n\n📋 أكمل المهام واكسب *TON*\n👥 *+{bonus} TON* لكل إحالة\n💎 {minRefs} إحالات للسحب`,
    zh: `✅ *账户已创建！*\n\n📋 完成任务赚取 *TON*\n👥 每次推荐 *+{bonus} TON*\n💎 需 {minRefs} 次推荐才能提现`,
    hi: `✅ *खाता बन गया!*\n\n📋 कार्य पूरा करें और *TON* कमाएं\n👥 प्रत्येक रेफरल पर *+{bonus} TON*\n💎 निकासी के लिए {minRefs} रेफरल`,
    tr: `✅ *Hesap oluşturuldu!*\n\n📋 Görevleri tamamla ve *TON* kazan\n👥 Her yönlendirme için *+{bonus} TON*\n💎 Çekim için {minRefs} yönlendirme`,
    id: `✅ *Akun dibuat!*\n\n📋 Selesaikan tugas dan dapatkan *TON*\n👥 *+{bonus} TON* per referral\n💎 {minRefs} referral untuk withdraw`,
  },

  // Erros gerais
  use_start_first: {
    pt: `❌ Usa /start primeiro.`,
    en: `❌ Use /start first.`,
    es: `❌ Usa /start primero.`,
    fr: `❌ Utilise /start d'abord.`,
    de: `❌ Bitte zuerst /start verwenden.`,
    it: `❌ Usa prima /start.`,
    ru: `❌ Сначала используй /start.`,
    uk: `❌ Спочатку використай /start.`,
    ar: `❌ استخدم /start أولاً.`,
    zh: `❌ 请先使用 /start。`,
    hi: `❌ पहले /start का उपयोग करें।`,
    tr: `❌ Önce /start kullan.`,
    id: `❌ Gunakan /start dulu.`,
  },

  start_error: {
    pt: `⚠️ Houve um problema ao carregar o teu perfil.\n\nTenta /inicio para aceder ao menu directamente.`,
    en: `⚠️ There was a problem loading your profile.\n\nTry /inicio to access the menu directly.`,
    es: `⚠️ Hubo un problema al cargar tu perfil.\n\nIntenta /inicio para acceder al menú directamente.`,
    fr: `⚠️ Un problème est survenu lors du chargement de ton profil.\n\nEssaie /inicio pour accéder au menu directement.`,
    de: `⚠️ Beim Laden deines Profils ist ein Fehler aufgetreten.\n\nVerwende /inicio für direkten Menüzugang.`,
    it: `⚠️ Si è verificato un problema nel caricamento del tuo profilo.\n\nProva /inicio per accedere al menu direttamente.`,
    ru: `⚠️ Возникла проблема при загрузке профиля.\n\nИспользуй /inicio для прямого доступа к меню.`,
    uk: `⚠️ Виникла проблема при завантаженні профілю.\n\nВикористай /inicio для прямого доступу до меню.`,
    ar: `⚠️ حدثت مشكلة أثناء تحميل ملفك الشخصي.\n\nجرب /inicio للوصول المباشر للقائمة.`,
    zh: `⚠️ 加载您的个人资料时出现问题。\n\n尝试 /inicio 直接访问菜单。`,
    hi: `⚠️ आपकी प्रोफ़ाइल लोड करने में समस्या हुई।\n\nमेनू तक सीधे पहुँचने के लिए /inicio आज़माएं।`,
    tr: `⚠️ Profil yüklenirken bir sorun oluştu.\n\nMenüye doğrudan erişmek için /inicio dene.`,
    id: `⚠️ Ada masalah saat memuat profilmu.\n\nCoba /inicio untuk langsung akses menu.`,
  },

  unknown_command: {
    pt: `❓ Comando desconhecido. Usa /ajuda.`,
    en: `❓ Unknown command. Use /help.`,
    es: `❓ Comando desconocido. Usa /ayuda.`,
    fr: `❓ Commande inconnue. Utilise /aide.`,
    de: `❓ Unbekannter Befehl. Verwende /hilfe.`,
    it: `❓ Comando sconosciuto. Usa /aiuto.`,
    ru: `❓ Неизвестная команда. Используй /помощь.`,
    uk: `❓ Невідома команда. Використай /допомога.`,
    ar: `❓ أمر غير معروف. استخدم /مساعدة.`,
    zh: `❓ 未知命令。使用 /帮助。`,
    hi: `❓ अज्ञात कमांड। /सहायता उपयोग करें।`,
    tr: `❓ Bilinmeyen komut. /yardım kullan.`,
    id: `❓ Perintah tidak dikenal. Gunakan /bantuan.`,
  },

  session_expired: {
    pt: `⏱ A tua sessão expirou. Usa /start para recomeçar.`,
    en: `⏱ Your session expired. Use /start to restart.`,
    es: `⏱ Tu sesión expiró. Usa /start para reiniciar.`,
    fr: `⏱ Ta session a expiré. Utilise /start pour recommencer.`,
    de: `⏱ Deine Sitzung ist abgelaufen. Verwende /start zum Neustarten.`,
    it: `⏱ La tua sessione è scaduta. Usa /start per ricominciare.`,
    ru: `⏱ Сессия истекла. Используй /start для перезапуска.`,
    uk: `⏱ Сесія закінчилась. Використай /start для перезапуску.`,
    ar: `⏱ انتهت صلاحية جلستك. استخدم /start للبدء من جديد.`,
    zh: `⏱ 您的会话已过期。使用 /start 重新开始。`,
    hi: `⏱ आपका सत्र समाप्त हो गया। पुनः शुरू करने के लिए /start का उपयोग करें।`,
    tr: `⏱ Oturumun sona erdi. Yeniden başlamak için /start kullan.`,
    id: `⏱ Sesimu kedaluwarsa. Gunakan /start untuk mulai lagi.`,
  },

  // ── Saldo / Carteira ─────────────────────────────────────────────────

  balance_title: {
    pt: `💎 *Carteira TaskMarket*\n\nSaldo: *{saldo} TON*\n\n👥 Referências: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    en: `💎 *TaskMarket Wallet*\n\nBalance: *{saldo} TON*\n\n👥 Referrals: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    es: `💎 *Cartera TaskMarket*\n\nSaldo: *{saldo} TON*\n\n👥 Referidos: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    fr: `💎 *Portefeuille TaskMarket*\n\nSolde : *{saldo} TON*\n\n👥 Parrainages : *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    de: `💎 *TaskMarket Wallet*\n\nGuthaben: *{saldo} TON*\n\n👥 Empfehlungen: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    it: `💎 *Portafoglio TaskMarket*\n\nSaldo: *{saldo} TON*\n\n👥 Riferimenti: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    ru: `💎 *Кошелёк TaskMarket*\n\nБаланс: *{saldo} TON*\n\n👥 Рефералы: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    uk: `💎 *Гаманець TaskMarket*\n\nБаланс: *{saldo} TON*\n\n👥 Реферали: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    ar: `💎 *محفظة TaskMarket*\n\nالرصيد: *{saldo} TON*\n\n👥 الإحالات: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    zh: `💎 *TaskMarket 钱包*\n\n余额：*{saldo} TON*\n\n👥 推荐：*{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    hi: `💎 *TaskMarket वॉलेट*\n\nशेष: *{saldo} TON*\n\n👥 रेफरल: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    tr: `💎 *TaskMarket Cüzdan*\n\nBakiye: *{saldo} TON*\n\n👥 Yönlendirmeler: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
    id: `💎 *Dompet TaskMarket*\n\nSaldo: *{saldo} TON*\n\n👥 Referral: *{refs}/{minRefs}*\n{bar}\n\n{statusLine}`,
  },

  balance_withdraw_ready: {
    pt: `✅ Saque disponível — /sacar`,
    en: `✅ Withdrawal available — /sacar`,
    es: `✅ Retiro disponible — /sacar`,
    fr: `✅ Retrait disponible — /sacar`,
    de: `✅ Auszahlung verfügbar — /sacar`,
    it: `✅ Prelievo disponibile — /sacar`,
    ru: `✅ Вывод доступен — /sacar`,
    uk: `✅ Виведення доступне — /sacar`,
    ar: `✅ السحب متاح — /sacar`,
    zh: `✅ 可以提现 — /sacar`,
    hi: `✅ निकासी उपलब्ध — /sacar`,
    tr: `✅ Çekim mevcut — /sacar`,
    id: `✅ Penarikan tersedia — /sacar`,
  },

  balance_withdraw_locked: {
    pt: `⏳ Faltam *{faltam}* para sacar.`,
    en: `⏳ *{faltam}* more referrals to withdraw.`,
    es: `⏳ Faltan *{faltam}* para retirar.`,
    fr: `⏳ Il manque *{faltam}* parrainages pour retirer.`,
    de: `⏳ Noch *{faltam}* Empfehlungen bis zur Auszahlung.`,
    it: `⏳ Mancano *{faltam}* riferimenti per prelevare.`,
    ru: `⏳ Ещё *{faltam}* рефералов до вывода.`,
    uk: `⏳ Ще *{faltam}* рефералів до виведення.`,
    ar: `⏳ تحتاج *{faltam}* إحالة أخرى للسحب.`,
    zh: `⏳ 还需 *{faltam}* 次推荐才能提现。`,
    hi: `⏳ निकासी के लिए *{faltam}* और रेफरल चाहिए।`,
    tr: `⏳ Çekim için *{faltam}* daha yönlendirme gerekiyor.`,
    id: `⏳ Butuh *{faltam}* referral lagi untuk withdraw.`,
  },

  // ── Saque ────────────────────────────────────────────────────────────

  withdraw_blocked: {
    pt: `❌ *Saque bloqueado*\n\nPrecisas de *{minRefs}* referências.\nTens *{refs}*. Faltam *{faltam}*.`,
    en: `❌ *Withdrawal blocked*\n\nYou need *{minRefs}* referrals.\nYou have *{refs}*. Need *{faltam}* more.`,
    es: `❌ *Retiro bloqueado*\n\nNecesitas *{minRefs}* referidos.\nTienes *{refs}*. Faltan *{faltam}*.`,
    fr: `❌ *Retrait bloqué*\n\nTu as besoin de *{minRefs}* parrainages.\nTu en as *{refs}*. Il en manque *{faltam}*.`,
    de: `❌ *Auszahlung gesperrt*\n\nDu benötigst *{minRefs}* Empfehlungen.\nDu hast *{refs}*. Noch *{faltam}* fehlend.`,
    it: `❌ *Prelievo bloccato*\n\nHai bisogno di *{minRefs}* riferimenti.\nNe hai *{refs}*. Mancano *{faltam}*.`,
    ru: `❌ *Вывод заблокирован*\n\nНужно *{minRefs}* рефералов.\nЕсть *{refs}*. Не хватает *{faltam}*.`,
    uk: `❌ *Виведення заблоковано*\n\nПотрібно *{minRefs}* рефералів.\nЄ *{refs}*. Не вистачає *{faltam}*.`,
    ar: `❌ *السحب محظور*\n\nتحتاج *{minRefs}* إحالة.\nلديك *{refs}*. ينقصك *{faltam}*.`,
    zh: `❌ *提现已锁定*\n\n需要 *{minRefs}* 次推荐。\n您有 *{refs}* 次。还差 *{faltam}* 次。`,
    hi: `❌ *निकासी अवरुद्ध*\n\nआपको *{minRefs}* रेफरल चाहिए।\nआपके पास *{refs}* हैं। *{faltam}* और चाहिए।`,
    tr: `❌ *Çekim engellendi*\n\n*{minRefs}* yönlendirme gerekiyor.\n*{refs}* var. *{faltam}* daha gerekiyor.`,
    id: `❌ *Penarikan diblokir*\n\nButuh *{minRefs}* referral.\nKamu punya *{refs}*. Kurang *{faltam}*.`,
  },

  withdraw_ask_amount: {
    pt: `💸 *Saque de TON*\n\nSaldo: *{saldo} TON*\n\nEnvia o *valor* (ex: \`1.5\`):`,
    en: `💸 *TON Withdrawal*\n\nBalance: *{saldo} TON*\n\nSend the *amount* (e.g. \`1.5\`):`,
    es: `💸 *Retiro de TON*\n\nSaldo: *{saldo} TON*\n\nEnvía el *monto* (ej: \`1.5\`):`,
    fr: `💸 *Retrait de TON*\n\nSolde : *{saldo} TON*\n\nEnvoie le *montant* (ex : \`1.5\`) :`,
    de: `💸 *TON-Auszahlung*\n\nGuthaben: *{saldo} TON*\n\nSende den *Betrag* (z.B. \`1.5\`):`,
    it: `💸 *Prelievo TON*\n\nSaldo: *{saldo} TON*\n\nInvia l'*importo* (es. \`1.5\`):`,
    ru: `💸 *Вывод TON*\n\nБаланс: *{saldo} TON*\n\nОтправь *сумму* (напр. \`1.5\`):`,
    uk: `💸 *Виведення TON*\n\nБаланс: *{saldo} TON*\n\nНадішли *суму* (напр. \`1.5\`):`,
    ar: `💸 *سحب TON*\n\nالرصيد: *{saldo} TON*\n\nأرسل *المبلغ* (مثال: \`1.5\`):`,
    zh: `💸 *TON 提现*\n\n余额：*{saldo} TON*\n\n发送*金额*（例如 \`1.5\`）：`,
    hi: `💸 *TON निकासी*\n\nशेष: *{saldo} TON*\n\n*राशि* भेजें (जैसे \`1.5\`):`,
    tr: `💸 *TON Çekimi*\n\nBakiye: *{saldo} TON*\n\n*Tutarı* gönder (örn. \`1.5\`):`,
    id: `💸 *Penarikan TON*\n\nSaldo: *{saldo} TON*\n\nKirim *jumlah* (mis. \`1.5\`):`,
  },

  withdraw_cancelled: {
    pt: `❌ Saque cancelado.`,
    en: `❌ Withdrawal cancelled.`,
    es: `❌ Retiro cancelado.`,
    fr: `❌ Retrait annulé.`,
    de: `❌ Auszahlung abgebrochen.`,
    it: `❌ Prelievo annullato.`,
    ru: `❌ Вывод отменён.`,
    uk: `❌ Виведення скасовано.`,
    ar: `❌ تم إلغاء السحب.`,
    zh: `❌ 提现已取消。`,
    hi: `❌ निकासी रद्द।`,
    tr: `❌ Çekim iptal edildi.`,
    id: `❌ Penarikan dibatalkan.`,
  },

  // ── Depósito ─────────────────────────────────────────────────────────

  deposit_title: {
    pt: `💰 *Depositar TON via xRocket*\n\nEscolhe o valor:`,
    en: `💰 *Deposit TON via xRocket*\n\nChoose the amount:`,
    es: `💰 *Depositar TON via xRocket*\n\nElige el monto:`,
    fr: `💰 *Dépôt de TON via xRocket*\n\nChoisis le montant :`,
    de: `💰 *TON einzahlen via xRocket*\n\nBetrag wählen:`,
    it: `💰 *Deposita TON via xRocket*\n\nScegli l'importo:`,
    ru: `💰 *Пополнение TON через xRocket*\n\nВыбери сумму:`,
    uk: `💰 *Поповнення TON через xRocket*\n\nОбери суму:`,
    ar: `💰 *إيداع TON عبر xRocket*\n\nاختر المبلغ:`,
    zh: `💰 *通过 xRocket 充值 TON*\n\n选择金额：`,
    hi: `💰 *xRocket के माध्यम से TON जमा करें*\n\nराशि चुनें:`,
    tr: `💰 *xRocket ile TON Yatır*\n\nTutar seç:`,
    id: `💰 *Deposit TON via xRocket*\n\nPilih jumlah:`,
  },

  deposit_creating: {
    pt: `⏳ A criar invoice para *{amount} TON*…`,
    en: `⏳ Creating invoice for *{amount} TON*…`,
    es: `⏳ Creando factura para *{amount} TON*…`,
    fr: `⏳ Création de la facture pour *{amount} TON*…`,
    de: `⏳ Rechnung für *{amount} TON* wird erstellt…`,
    it: `⏳ Creazione fattura per *{amount} TON*…`,
    ru: `⏳ Создаю счёт на *{amount} TON*…`,
    uk: `⏳ Створюю рахунок на *{amount} TON*…`,
    ar: `⏳ جارٍ إنشاء فاتورة لـ *{amount} TON*…`,
    zh: `⏳ 正在为 *{amount} TON* 创建发票…`,
    hi: `⏳ *{amount} TON* के लिए इनवॉयस बना रहे हैं…`,
    tr: `⏳ *{amount} TON* için fatura oluşturuluyor…`,
    id: `⏳ Membuat invoice untuk *{amount} TON*…`,
  },

  deposit_invoice_ready: {
    pt: `💰 *Invoice criado!*\n\nValor: *{amount} TON*\nID: \`{invoiceId}\`\nExpira às: *{expiry}*\n\nClica em Pagar — o saldo é creditado automaticamente.`,
    en: `💰 *Invoice created!*\n\nAmount: *{amount} TON*\nID: \`{invoiceId}\`\nExpires at: *{expiry}*\n\nClick Pay — balance is credited automatically.`,
    es: `💰 *¡Factura creada!*\n\nMonto: *{amount} TON*\nID: \`{invoiceId}\`\nVence a las: *{expiry}*\n\nHaz clic en Pagar — el saldo se acredita automáticamente.`,
    fr: `💰 *Facture créée !*\n\nMontant : *{amount} TON*\nID : \`{invoiceId}\`\nExpire à : *{expiry}*\n\nClique sur Payer — le solde est crédité automatiquement.`,
    de: `💰 *Rechnung erstellt!*\n\nBetrag: *{amount} TON*\nID: \`{invoiceId}\`\nLäuft ab um: *{expiry}*\n\nKlicke auf Zahlen — Guthaben wird automatisch gutgeschrieben.`,
    it: `💰 *Fattura creata!*\n\nImporto: *{amount} TON*\nID: \`{invoiceId}\`\nScade alle: *{expiry}*\n\nClicca su Paga — il saldo viene accreditato automaticamente.`,
    ru: `💰 *Счёт создан!*\n\nСумма: *{amount} TON*\nID: \`{invoiceId}\`\nИстекает: *{expiry}*\n\nНажми Оплатить — баланс пополнится автоматически.`,
    uk: `💰 *Рахунок створено!*\n\nСума: *{amount} TON*\nID: \`{invoiceId}\`\nДійсний до: *{expiry}*\n\nНатисни Оплатити — баланс поповниться автоматично.`,
    ar: `💰 *تم إنشاء الفاتورة!*\n\nالمبلغ: *{amount} TON*\nID: \`{invoiceId}\`\nتنتهي في: *{expiry}*\n\nانقر على ادفع — سيُضاف الرصيد تلقائياً.`,
    zh: `💰 *发票已创建！*\n\n金额：*{amount} TON*\nID：\`{invoiceId}\`\n到期时间：*{expiry}*\n\n点击支付——余额将自动到账。`,
    hi: `💰 *इनवॉयस बन गया!*\n\nराशि: *{amount} TON*\nID: \`{invoiceId}\`\nसमाप्ति: *{expiry}*\n\nभुगतान पर क्लिक करें — शेष स्वतः जमा होगा।`,
    tr: `💰 *Fatura oluşturuldu!*\n\nTutar: *{amount} TON*\nID: \`{invoiceId}\`\nSona erme: *{expiry}*\n\nÖde'ye tıkla — bakiye otomatik yüklenir.`,
    id: `💰 *Invoice dibuat!*\n\nJumlah: *{amount} TON*\nID: \`{invoiceId}\`\nKadaluarsa: *{expiry}*\n\nKlik Bayar — saldo otomatis dikreditkan.`,
  },

  deposit_confirmed: {
    pt: `✅ *Depósito confirmado!*\n\n*+{amount} TON* adicionado.\nNovo saldo: *{saldo} TON*`,
    en: `✅ *Deposit confirmed!*\n\n*+{amount} TON* added.\nNew balance: *{saldo} TON*`,
    es: `✅ *¡Depósito confirmado!*\n\n*+{amount} TON* añadido.\nNuevo saldo: *{saldo} TON*`,
    fr: `✅ *Dépôt confirmé !*\n\n*+{amount} TON* ajouté.\nNouveau solde : *{saldo} TON*`,
    de: `✅ *Einzahlung bestätigt!*\n\n*+{amount} TON* hinzugefügt.\nNeues Guthaben: *{saldo} TON*`,
    it: `✅ *Deposito confermato!*\n\n*+{amount} TON* aggiunto.\nNuovo saldo: *{saldo} TON*`,
    ru: `✅ *Депозит подтверждён!*\n\n*+{amount} TON* добавлено.\nНовый баланс: *{saldo} TON*`,
    uk: `✅ *Депозит підтверджено!*\n\n*+{amount} TON* додано.\nНовий баланс: *{saldo} TON*`,
    ar: `✅ *تم تأكيد الإيداع!*\n\n*+{amount} TON* مضاف.\nالرصيد الجديد: *{saldo} TON*`,
    zh: `✅ *充值已确认！*\n\n已添加 *+{amount} TON*。\n新余额：*{saldo} TON*`,
    hi: `✅ *जमा की पुष्टि हुई!*\n\n*+{amount} TON* जोड़ा गया।\nनया शेष: *{saldo} TON*`,
    tr: `✅ *Para yatırma onaylandı!*\n\n*+{amount} TON* eklendi.\nYeni bakiye: *{saldo} TON*`,
    id: `✅ *Deposit dikonfirmasi!*\n\n*+{amount} TON* ditambahkan.\nSaldo baru: *{saldo} TON*`,
  },

  deposit_expired: {
    pt: `⏱ *Invoice expirado.*\n\nCria um novo com /depositar.`,
    en: `⏱ *Invoice expired.*\n\nCreate a new one with /depositar.`,
    es: `⏱ *Factura expirada.*\n\nCrea una nueva con /depositar.`,
    fr: `⏱ *Facture expirée.*\n\nCrée-en une nouvelle avec /depositar.`,
    de: `⏱ *Rechnung abgelaufen.*\n\nErstelle eine neue mit /depositar.`,
    it: `⏱ *Fattura scaduta.*\n\nCreane una nuova con /depositar.`,
    ru: `⏱ *Счёт истёк.*\n\nСоздай новый через /depositar.`,
    uk: `⏱ *Рахунок прострочено.*\n\nСтвори новий через /depositar.`,
    ar: `⏱ *انتهت صلاحية الفاتورة.*\n\nأنشئ فاتورة جديدة عبر /depositar.`,
    zh: `⏱ *发票已过期。*\n\n使用 /depositar 创建新发票。`,
    hi: `⏱ *इनवॉयस समाप्त हो गया।*\n\n/depositar से नया बनाएं।`,
    tr: `⏱ *Fatura sona erdi.*\n\n/depositar ile yenisini oluştur.`,
    id: `⏱ *Invoice kedaluwarsa.*\n\nBuat yang baru dengan /depositar.`,
  },

  deposit_cancelled: {
    pt: `❌ Depósito cancelado.`,
    en: `❌ Deposit cancelled.`,
    es: `❌ Depósito cancelado.`,
    fr: `❌ Dépôt annulé.`,
    de: `❌ Einzahlung abgebrochen.`,
    it: `❌ Deposito annullato.`,
    ru: `❌ Депозит отменён.`,
    uk: `❌ Депозит скасовано.`,
    ar: `❌ تم إلغاء الإيداع.`,
    zh: `❌ 充值已取消。`,
    hi: `❌ जमा रद्द।`,
    tr: `❌ Para yatırma iptal edildi.`,
    id: `❌ Deposit dibatalkan.`,
  },

  deposit_error: {
    pt: `❌ Erro ao criar invoice. Tenta novamente com /depositar.`,
    en: `❌ Error creating invoice. Try again with /depositar.`,
    es: `❌ Error al crear la factura. Intenta de nuevo con /depositar.`,
    fr: `❌ Erreur lors de la création de la facture. Réessaie avec /depositar.`,
    de: `❌ Fehler beim Erstellen der Rechnung. Versuche es erneut mit /depositar.`,
    it: `❌ Errore nella creazione della fattura. Riprova con /depositar.`,
    ru: `❌ Ошибка создания счёта. Попробуй снова с /depositar.`,
    uk: `❌ Помилка створення рахунку. Спробуй знову з /depositar.`,
    ar: `❌ خطأ في إنشاء الفاتورة. حاول مرة أخرى مع /depositar.`,
    zh: `❌ 创建发票出错。请使用 /depositar 重试。`,
    hi: `❌ इनवॉयस बनाने में त्रुटि। /depositar से पुनः प्रयास करें।`,
    tr: `❌ Fatura oluşturma hatası. /depositar ile tekrar dene.`,
    id: `❌ Error membuat invoice. Coba lagi dengan /depositar.`,
  },

  // ── Tarefas ──────────────────────────────────────────────────────────

  tasks_title: {
    pt: `📋 *Tarefas Disponíveis* ({total} total)`,
    en: `📋 *Available Tasks* ({total} total)`,
    es: `📋 *Tareas Disponibles* ({total} en total)`,
    fr: `📋 *Tâches Disponibles* ({total} au total)`,
    de: `📋 *Verfügbare Aufgaben* ({total} gesamt)`,
    it: `📋 *Attività Disponibili* ({total} in totale)`,
    ru: `📋 *Доступные Задания* ({total} всего)`,
    uk: `📋 *Доступні Завдання* ({total} всього)`,
    ar: `📋 *المهام المتاحة* ({total} إجمالاً)`,
    zh: `📋 *可用任务*（共 {total} 个）`,
    hi: `📋 *उपलब्ध कार्य* (कुल {total})`,
    tr: `📋 *Mevcut Görevler* (toplam {total})`,
    id: `📋 *Tugas Tersedia* ({total} total)`,
  },

  tasks_empty: {
    pt: `📋 *Tarefas Disponíveis*\n\nNenhuma tarefa aberta.\nVolta mais tarde!`,
    en: `📋 *Available Tasks*\n\nNo open tasks.\nCome back later!`,
    es: `📋 *Tareas Disponibles*\n\nNo hay tareas abiertas.\n¡Vuelve más tarde!`,
    fr: `📋 *Tâches Disponibles*\n\nAucune tâche ouverte.\nReviens plus tard !`,
    de: `📋 *Verfügbare Aufgaben*\n\nKeine offenen Aufgaben.\nKomm später wieder!`,
    it: `📋 *Attività Disponibili*\n\nNessuna attività aperta.\nTorna più tardi!`,
    ru: `📋 *Доступные Задания*\n\nНет открытых заданий.\nВернись позже!`,
    uk: `📋 *Доступні Завдання*\n\nНемає відкритих завдань.\nПовернись пізніше!`,
    ar: `📋 *المهام المتاحة*\n\nلا توجد مهام مفتوحة.\nعد لاحقاً!`,
    zh: `📋 *可用任务*\n\n暂无开放任务。\n请稍后再来！`,
    hi: `📋 *उपलब्ध कार्य*\n\nकोई खुला कार्य नहीं।\nबाद में वापस आएं!`,
    tr: `📋 *Mevcut Görevler*\n\nAçık görev yok.\nDaha sonra tekrar gel!`,
    id: `📋 *Tugas Tersedia*\n\nTidak ada tugas yang terbuka.\nKembali lagi nanti!`,
  },

  tasks_click_hint: {
    pt: `_Clica numa tarefa para ver detalhes:_`,
    en: `_Click a task to view details:_`,
    es: `_Haz clic en una tarea para ver detalles:_`,
    fr: `_Clique sur une tâche pour voir les détails :_`,
    de: `_Klicke auf eine Aufgabe für Details:_`,
    it: `_Clicca su un'attività per i dettagli:_`,
    ru: `_Нажми на задание, чтобы увидеть детали:_`,
    uk: `_Натисни на завдання, щоб побачити деталі:_`,
    ar: `_انقر على مهمة لرؤية التفاصيل:_`,
    zh: `_点击任务查看详情：_`,
    hi: `_विवरण देखने के लिए किसी कार्य पर क्लिक करें:_`,
    tr: `_Detayları görmek için bir göreve tıkla:_`,
    id: `_Klik tugas untuk lihat detail:_`,
  },

  task_accepted: {
    pt: `✅ *Tarefa aceite!*\n\n"{title}"\n\n{linkLine}Quando terminares usa /minhas para submeter.`,
    en: `✅ *Task accepted!*\n\n"{title}"\n\n{linkLine}When done, use /minhas to submit.`,
    es: `✅ *¡Tarea aceptada!*\n\n"{title}"\n\n{linkLine}Cuando termines usa /minhas para enviar.`,
    fr: `✅ *Tâche acceptée !*\n\n"{title}"\n\n{linkLine}Quand tu as terminé, utilise /minhas pour soumettre.`,
    de: `✅ *Aufgabe angenommen!*\n\n"{title}"\n\n{linkLine}Wenn fertig, nutze /minhas zum Einreichen.`,
    it: `✅ *Attività accettata!*\n\n"{title}"\n\n{linkLine}Quando finisci usa /minhas per inviare.`,
    ru: `✅ *Задание принято!*\n\n"{title}"\n\n{linkLine}По завершении используй /minhas для отправки.`,
    uk: `✅ *Завдання прийнято!*\n\n"{title}"\n\n{linkLine}Після завершення використай /minhas для подачі.`,
    ar: `✅ *تم قبول المهمة!*\n\n"{title}"\n\n{linkLine}عند الانتهاء استخدم /minhas للإرسال.`,
    zh: `✅ *任务已接受！*\n\n"{title}"\n\n{linkLine}完成后使用 /minhas 提交。`,
    hi: `✅ *कार्य स्वीकार हुआ!*\n\n"{title}"\n\n{linkLine}पूरा होने पर /minhas से सबमिट करें।`,
    tr: `✅ *Görev kabul edildi!*\n\n"{title}"\n\n{linkLine}Bitince /minhas ile gönder.`,
    id: `✅ *Tugas diterima!*\n\n"{title}"\n\n{linkLine}Setelah selesai, gunakan /minhas untuk submit.`,
  },

  task_submitted: {
    pt: `📤 *Submetido!*\n\nAnunciante notificado. Aguarda aprovação.`,
    en: `📤 *Submitted!*\n\nAdvertiser notified. Waiting for approval.`,
    es: `📤 *¡Enviado!*\n\nAnunciante notificado. Espera la aprobación.`,
    fr: `📤 *Soumis !*\n\nAnnonceur notifié. En attente d'approbation.`,
    de: `📤 *Eingereicht!*\n\nAuftraggeber benachrichtigt. Warte auf Genehmigung.`,
    it: `📤 *Inviato!*\n\nInserzionista notificato. In attesa di approvazione.`,
    ru: `📤 *Отправлено!*\n\nЗаказчик уведомлён. Ожидай одобрения.`,
    uk: `📤 *Надіслано!*\n\nРекламодавець сповіщений. Чекай на підтвердження.`,
    ar: `📤 *تم الإرسال!*\n\nتم إخطار المعلن. انتظر الموافقة.`,
    zh: `📤 *已提交！*\n\n已通知广告主。等待审核。`,
    hi: `📤 *सबमिट हुआ!*\n\nविज्ञापनदाता को सूचित किया। अनुमोदन की प्रतीक्षा करें।`,
    tr: `📤 *Gönderildi!*\n\nReklamveren bildirildi. Onay bekleniyor.`,
    id: `📤 *Dikirim!*\n\nPengiklan diberitahu. Menunggu persetujuan.`,
  },

  task_approved: {
    pt: `✅ *Aprovado!*\n*{reward} TON* enviados para @{executor}.`,
    en: `✅ *Approved!*\n*{reward} TON* sent to @{executor}.`,
    es: `✅ *¡Aprobado!*\n*{reward} TON* enviados a @{executor}.`,
    fr: `✅ *Approuvé !*\n*{reward} TON* envoyés à @{executor}.`,
    de: `✅ *Genehmigt!*\n*{reward} TON* an @{executor} gesendet.`,
    it: `✅ *Approvato!*\n*{reward} TON* inviati a @{executor}.`,
    ru: `✅ *Одобрено!*\n*{reward} TON* отправлено @{executor}.`,
    uk: `✅ *Затверджено!*\n*{reward} TON* надіслано @{executor}.`,
    ar: `✅ *تمت الموافقة!*\n*{reward} TON* أُرسلت إلى @{executor}.`,
    zh: `✅ *已批准！*\n已向 @{executor} 发送 *{reward} TON*。`,
    hi: `✅ *अनुमोदित!*\n@{executor} को *{reward} TON* भेजे।`,
    tr: `✅ *Onaylandı!*\n@{executor}'ya *{reward} TON* gönderildi.`,
    id: `✅ *Disetujui!*\n*{reward} TON* dikirim ke @{executor}.`,
  },

  task_paid: {
    pt: `✅ *Pagamento recebido!*\n"{title}"\n💎 *+{reward} TON* na tua carteira!`,
    en: `✅ *Payment received!*\n"{title}"\n💎 *+{reward} TON* in your wallet!`,
    es: `✅ *¡Pago recibido!*\n"{title}"\n💎 *+{reward} TON* en tu cartera!`,
    fr: `✅ *Paiement reçu !*\n"{title}"\n💎 *+{reward} TON* dans ton portefeuille !`,
    de: `✅ *Zahlung erhalten!*\n"{title}"\n💎 *+{reward} TON* in deiner Wallet!`,
    it: `✅ *Pagamento ricevuto!*\n"{title}"\n💎 *+{reward} TON* nel tuo portafoglio!`,
    ru: `✅ *Оплата получена!*\n"{title}"\n💎 *+{reward} TON* в кошельке!`,
    uk: `✅ *Оплату отримано!*\n"{title}"\n💎 *+{reward} TON* у гаманці!`,
    ar: `✅ *تم استلام الدفع!*\n"{title}"\n💎 *+{reward} TON* في محفظتك!`,
    zh: `✅ *已收款！*\n"{title}"\n💎 *+{reward} TON* 已到账！`,
    hi: `✅ *भुगतान मिला!*\n"{title}"\n💎 *+{reward} TON* आपके वॉलेट में!`,
    tr: `✅ *Ödeme alındı!*\n"{title}"\n💎 *+{reward} TON* cüzdanında!`,
    id: `✅ *Pembayaran diterima!*\n"{title}"\n💎 *+{reward} TON* di dompetmu!`,
  },

  task_cancelled: {
    pt: `✅ *Tarefa cancelada.*\n\n💎 *+{refund} TON* reembolsado.\n_(Taxa de {fee} TON não reembolsada.)_`,
    en: `✅ *Task cancelled.*\n\n💎 *+{refund} TON* refunded.\n_(Listing fee of {fee} TON not refunded.)_`,
    es: `✅ *Tarea cancelada.*\n\n💎 *+{refund} TON* reembolsado.\n_(La tarifa de {fee} TON no se reembolsa.)_`,
    fr: `✅ *Tâche annulée.*\n\n💎 *+{refund} TON* remboursé.\n_(Les frais de {fee} TON ne sont pas remboursés.)_`,
    de: `✅ *Aufgabe abgebrochen.*\n\n💎 *+{refund} TON* erstattet.\n_(Listungsgebühr {fee} TON nicht erstattet.)_`,
    it: `✅ *Attività annullata.*\n\n💎 *+{refund} TON* rimborsato.\n_(La commissione di {fee} TON non viene rimborsata.)_`,
    ru: `✅ *Задание отменено.*\n\n💎 *+{refund} TON* возвращено.\n_(Комиссия {fee} TON не возвращается.)_`,
    uk: `✅ *Завдання скасовано.*\n\n💎 *+{refund} TON* повернуто.\n_(Комісія {fee} TON не повертається.)_`,
    ar: `✅ *تم إلغاء المهمة.*\n\n💎 *+{refund} TON* مستردة.\n_(رسوم {fee} TON غير قابلة للاسترداد.)_`,
    zh: `✅ *任务已取消。*\n\n💎 已退还 *+{refund} TON*。\n_(上架费 {fee} TON 不予退还。)_`,
    hi: `✅ *कार्य रद्द।*\n\n💎 *+{refund} TON* वापस हुआ।\n_(सूचीकरण शुल्क {fee} TON वापस नहीं होगा।)_`,
    tr: `✅ *Görev iptal edildi.*\n\n💎 *+{refund} TON* iade edildi.\n_(Listeleme ücreti {fee} TON iade edilmez.)_`,
    id: `✅ *Tugas dibatalkan.*\n\n💎 *+{refund} TON* dikembalikan.\n_(Biaya listing {fee} TON tidak dikembalikan.)_`,
  },

  // ── Referral ─────────────────────────────────────────────────────────

  referral_new: {
    pt: `🎉 *Nova referência!*\n\n@{username} entrou pelo teu link.\n💎 *+{bonus} TON* creditado!\n📊 *{count}/{minRefs}* referências\n\n{sufixo}`,
    en: `🎉 *New referral!*\n\n@{username} joined via your link.\n💎 *+{bonus} TON* credited!\n📊 *{count}/{minRefs}* referrals\n\n{sufixo}`,
    es: `🎉 *¡Nuevo referido!*\n\n@{username} se unió por tu enlace.\n💎 *+{bonus} TON* acreditado!\n📊 *{count}/{minRefs}* referidos\n\n{sufixo}`,
    fr: `🎉 *Nouveau parrainage !*\n\n@{username} a rejoint via ton lien.\n💎 *+{bonus} TON* crédité !\n📊 *{count}/{minRefs}* parrainages\n\n{sufixo}`,
    de: `🎉 *Neue Empfehlung!*\n\n@{username} ist über deinen Link beigetreten.\n💎 *+{bonus} TON* gutgeschrieben!\n📊 *{count}/{minRefs}* Empfehlungen\n\n{sufixo}`,
    it: `🎉 *Nuovo riferimento!*\n\n@{username} si è unito tramite il tuo link.\n💎 *+{bonus} TON* accreditato!\n📊 *{count}/{minRefs}* riferimenti\n\n{sufixo}`,
    ru: `🎉 *Новый реферал!*\n\n@{username} присоединился по твоей ссылке.\n💎 *+{bonus} TON* зачислено!\n📊 *{count}/{minRefs}* рефералов\n\n{sufixo}`,
    uk: `🎉 *Новий реферал!*\n\n@{username} приєднався за твоїм посиланням.\n💎 *+{bonus} TON* зараховано!\n📊 *{count}/{minRefs}* рефералів\n\n{sufixo}`,
    ar: `🎉 *إحالة جديدة!*\n\n@{username} انضم عبر رابطك.\n💎 *+{bonus} TON* تم إضافته!\n📊 *{count}/{minRefs}* إحالات\n\n{sufixo}`,
    zh: `🎉 *新推荐！*\n\n@{username} 通过您的链接加入。\n💎 *+{bonus} TON* 已到账！\n📊 *{count}/{minRefs}* 次推荐\n\n{sufixo}`,
    hi: `🎉 *नया रेफरल!*\n\n@{username} आपके लिंक से जुड़ा।\n💎 *+{bonus} TON* जमा!*\n📊 *{count}/{minRefs}* रेफरल\n\n{sufixo}`,
    tr: `🎉 *Yeni yönlendirme!*\n\n@{username} bağlantın ile katıldı.\n💎 *+{bonus} TON* yüklendi!\n📊 *{count}/{minRefs}* yönlendirme\n\n{sufixo}`,
    id: `🎉 *Referral baru!*\n\n@{username} bergabung lewat linkmu.\n💎 *+{bonus} TON* dikreditkan!\n📊 *{count}/{minRefs}* referral\n\n{sufixo}`,
  },

  referral_min_reached: {
    pt: `✅ Atingiste o mínimo! Usa /sacar.`,
    en: `✅ Minimum reached! Use /sacar to withdraw.`,
    es: `✅ ¡Mínimo alcanzado! Usa /sacar para retirar.`,
    fr: `✅ Minimum atteint ! Utilise /sacar pour retirer.`,
    de: `✅ Minimum erreicht! Nutze /sacar zum Auszahlen.`,
    it: `✅ Minimo raggiunto! Usa /sacar per prelevare.`,
    ru: `✅ Минимум достигнут! Используй /sacar для вывода.`,
    uk: `✅ Мінімум досягнуто! Використай /sacar для виведення.`,
    ar: `✅ تم الوصول للحد الأدنى! استخدم /sacar للسحب.`,
    zh: `✅ 已达最低要求！使用 /sacar 提现。`,
    hi: `✅ न्यूनतम पहुंच गया! निकासी के लिए /sacar का उपयोग करें।`,
    tr: `✅ Minimum ulaşıldı! Çekim için /sacar kullan.`,
    id: `✅ Minimum tercapai! Gunakan /sacar untuk withdraw.`,
  },

  referral_still_need: {
    pt: `⏳ Faltam *{faltam}* para sacar.`,
    en: `⏳ *{faltam}* more to withdraw.`,
    es: `⏳ Faltan *{faltam}* para retirar.`,
    fr: `⏳ Il manque *{faltam}* pour retirer.`,
    de: `⏳ Noch *{faltam}* bis zur Auszahlung.`,
    it: `⏳ Mancano *{faltam}* per prelevare.`,
    ru: `⏳ Ещё *{faltam}* до вывода.`,
    uk: `⏳ Ще *{faltam}* до виведення.`,
    ar: `⏳ تحتاج *{faltam}* أخرى للسحب.`,
    zh: `⏳ 还需 *{faltam}* 次才能提现。`,
    hi: `⏳ निकासी के लिए *{faltam}* और चाहिए।`,
    tr: `⏳ Çekim için *{faltam}* daha gerekiyor.`,
    id: `⏳ Butuh *{faltam}* lagi untuk withdraw.`,
  },

  // ── Ajuda ────────────────────────────────────────────────────────────

  help_text: {
    pt: `🤖 *TaskMarket — Comandos*\n\n/start     — Menu principal\n/saldo     — Ver saldo e carteira\n/depositar — Depositar TON via xRocket\n/sacar     — Sacar TON\n/tarefas   — Ver tarefas disponíveis\n/criar     — Publicar nova tarefa\n/minhas    — As tuas tarefas\n/referral  — Link e leaderboard\n/ajuda     — Este menu\n\n💎 *Como funciona:*\n• Executores completam tarefas e recebem TON\n• Taxa de listagem: *2 TON*\n• Saque com *{minRefs}* referências`,
    en: `🤖 *TaskMarket — Commands*\n\n/start     — Main menu\n/saldo     — View balance & wallet\n/depositar — Deposit TON via xRocket\n/sacar     — Withdraw TON\n/tarefas   — View available tasks\n/criar     — Post a new task\n/minhas    — Your tasks\n/referral  — Link & leaderboard\n/ajuda     — This menu\n\n💎 *How it works:*\n• Executors complete tasks and receive TON\n• Listing fee: *2 TON*\n• Withdraw with *{minRefs}* referrals`,
    es: `🤖 *TaskMarket — Comandos*\n\n/start     — Menú principal\n/saldo     — Ver saldo y cartera\n/depositar — Depositar TON via xRocket\n/sacar     — Retirar TON\n/tarefas   — Ver tareas disponibles\n/criar     — Publicar nueva tarea\n/minhas    — Tus tareas\n/referral  — Link y tabla de líderes\n/ajuda     — Este menú\n\n💎 *Cómo funciona:*\n• Los ejecutores completan tareas y reciben TON\n• Tarifa de listado: *2 TON*\n• Retira con *{minRefs}* referidos`,
    fr: `🤖 *TaskMarket — Commandes*\n\n/start     — Menu principal\n/saldo     — Voir solde et portefeuille\n/depositar — Déposer des TON via xRocket\n/sacar     — Retirer des TON\n/tarefas   — Voir les tâches disponibles\n/criar     — Publier une nouvelle tâche\n/minhas    — Tes tâches\n/referral  — Lien et classement\n/ajuda     — Ce menu\n\n💎 *Comment ça marche :*\n• Les exécuteurs complètent des tâches et reçoivent des TON\n• Frais de publication : *2 TON*\n• Retrait avec *{minRefs}* parrainages`,
    de: `🤖 *TaskMarket — Befehle*\n\n/start     — Hauptmenü\n/saldo     — Guthaben & Wallet\n/depositar — TON via xRocket einzahlen\n/sacar     — TON auszahlen\n/tarefas   — Verfügbare Aufgaben\n/criar     — Neue Aufgabe erstellen\n/minhas    — Deine Aufgaben\n/referral  — Link & Rangliste\n/ajuda     — Dieses Menü\n\n💎 *So funktioniert es:*\n• Ausführer erledigen Aufgaben und erhalten TON\n• Listungsgebühr: *2 TON*\n• Auszahlung mit *{minRefs}* Empfehlungen`,
    it: `🤖 *TaskMarket — Comandi*\n\n/start     — Menu principale\n/saldo     — Saldo e portafoglio\n/depositar — Deposita TON via xRocket\n/sacar     — Preleva TON\n/tarefas   — Attività disponibili\n/criar     — Pubblica nuova attività\n/minhas    — Le tue attività\n/referral  — Link e classifica\n/ajuda     — Questo menu\n\n💎 *Come funziona:*\n• Gli esecutori completano attività e ricevono TON\n• Commissione: *2 TON*\n• Preleva con *{minRefs}* riferimenti`,
    ru: `🤖 *TaskMarket — Команды*\n\n/start     — Главное меню\n/saldo     — Баланс и кошелёк\n/depositar — Пополнить TON через xRocket\n/sacar     — Вывести TON\n/tarefas   — Доступные задания\n/criar     — Создать задание\n/minhas    — Мои задания\n/referral  — Ссылка и лидерборд\n/ajuda     — Это меню\n\n💎 *Как это работает:*\n• Исполнители выполняют задания и получают TON\n• Комиссия: *2 TON*\n• Вывод при *{minRefs}* рефералах`,
    uk: `🤖 *TaskMarket — Команди*\n\n/start     — Головне меню\n/saldo     — Баланс і гаманець\n/depositar — Поповнити TON через xRocket\n/sacar     — Вивести TON\n/tarefas   — Доступні завдання\n/criar     — Створити завдання\n/minhas    — Мої завдання\n/referral  — Посилання та таблиця\n/ajuda     — Це меню\n\n💎 *Як це працює:*\n• Виконавці виконують завдання та отримують TON\n• Комісія: *2 TON*\n• Виведення при *{minRefs}* рефералах`,
    ar: `🤖 *TaskMarket — الأوامر*\n\n/start     — القائمة الرئيسية\n/saldo     — الرصيد والمحفظة\n/depositar — إيداع TON عبر xRocket\n/sacar     — سحب TON\n/tarefas   — المهام المتاحة\n/criar     — نشر مهمة جديدة\n/minhas    — مهامي\n/referral  — الرابط والترتيب\n/ajuda     — هذه القائمة\n\n💎 *كيف يعمل:*\n• المنفذون يكملون المهام ويتلقون TON\n• رسوم النشر: *2 TON*\n• السحب بـ *{minRefs}* إحالة`,
    zh: `🤖 *TaskMarket — 命令*\n\n/start     — 主菜单\n/saldo     — 余额与钱包\n/depositar — 通过 xRocket 充值 TON\n/sacar     — 提现 TON\n/tarefas   — 可用任务\n/criar     — 发布新任务\n/minhas    — 我的任务\n/referral  — 链接与排行榜\n/ajuda     — 此菜单\n\n💎 *运作方式：*\n• 执行者完成任务并获得 TON\n• 上架费：*2 TON*\n• 需 *{minRefs}* 次推荐才能提现`,
    hi: `🤖 *TaskMarket — कमांड*\n\n/start     — मुख्य मेनू\n/saldo     — शेष और वॉलेट\n/depositar — xRocket के जरिए TON जमा\n/sacar     — TON निकालें\n/tarefas   — उपलब्ध कार्य\n/criar     — नया कार्य पोस्ट करें\n/minhas    — मेरे कार्य\n/referral  — लिंक और लीडरबोर्ड\n/ajuda     — यह मेनू\n\n💎 *कैसे काम करता है:*\n• एक्जीक्यूटर कार्य पूरा कर TON कमाते हैं\n• लिस्टिंग शुल्क: *2 TON*\n• *{minRefs}* रेफरल पर निकासी`,
    tr: `🤖 *TaskMarket — Komutlar*\n\n/start     — Ana menü\n/saldo     — Bakiye ve cüzdan\n/depositar — xRocket ile TON yatır\n/sacar     — TON çek\n/tarefas   — Mevcut görevler\n/criar     — Yeni görev yayınla\n/minhas    — Görevlerim\n/referral  — Link ve sıralama\n/ajuda     — Bu menü\n\n💎 *Nasıl çalışır:*\n• Uygulayıcılar görevleri tamamlar ve TON alır\n• Listeleme ücreti: *2 TON*\n• *{minRefs}* yönlendirme ile çekim`,
    id: `🤖 *TaskMarket — Perintah*\n\n/start     — Menu utama\n/saldo     — Lihat saldo & dompet\n/depositar — Deposit TON via xRocket\n/sacar     — Tarik TON\n/tarefas   — Lihat tugas tersedia\n/criar     — Posting tugas baru\n/minhas    — Tugas saya\n/referral  — Link & leaderboard\n/ajuda     — Menu ini\n\n💎 *Cara kerja:*\n• Eksekutor menyelesaikan tugas dan menerima TON\n• Biaya listing: *2 TON*\n• Withdraw dengan *{minRefs}* referral`,
  },


  withdraw_blocked: {
    pt: `❌ *Saque bloqueado*\n\nPrecisas de *{minRefs}* referências.\nTens *{refs}*. Faltam *{faltam}*.`,
    en: `❌ *Withdrawal blocked*\n\nYou need *{minRefs}* referrals.\nYou have *{refs}*. Need *{faltam}* more.`,
    es: `❌ *Retiro bloqueado*\n\nNecesitas *{minRefs}* referidos.\nTienes *{refs}*. Faltan *{faltam}*.`,
    fr: `❌ *Retrait bloqué*\n\nTu as besoin de *{minRefs}* parrainages.\nTu en as *{refs}*. Il en manque *{faltam}*.`,
    de: `❌ *Auszahlung gesperrt*\n\nDu brauchst *{minRefs}* Empfehlungen.\nDu hast *{refs}*. Noch *{faltam}* fehlen.`,
    it: `❌ *Prelievo bloccato*\n\nHai bisogno di *{minRefs}* riferimenti.\nNe hai *{refs}*. Mancano *{faltam}*.`,
    ru: `❌ *Вывод заблокирован*\n\nНужно *{minRefs}* рефералов.\nЕсть *{refs}*. Не хватает *{faltam}*.`,
    uk: `❌ *Виведення заблоковано*\n\nПотрібно *{minRefs}* рефералів.\nМаєш *{refs}*. Не вистачає *{faltam}*.`,
    ar: `❌ *السحب محظور*\n\nتحتاج *{minRefs}* إحالة.\nلديك *{refs}*. تحتاج *{faltam}* أخرى.`,
    zh: `❌ *提现已锁定*\n\n需要 *{minRefs}* 次推荐。\n已有 *{refs}* 次，还需 *{faltam}* 次。`,
    hi: `❌ *निकासी बंद है*\n\n*{minRefs}* रेफरल चाहिए।\nआपके पास *{refs}* हैं। *{faltam}* और चाहिए।`,
    tr: `❌ *Çekim engellendi*\n\n*{minRefs}* yönlendirme gerekiyor.\n*{refs}* var. *{faltam}* daha gerekiyor.`,
    id: `❌ *Penarikan diblokir*\n\nButuh *{minRefs}* referral.\nPunya *{refs}*. Butuh *{faltam}* lagi.`,
  },

  balance_need_more: {
    pt: `⏳ Faltam *{faltam}* referências para sacar.`,
    en: `⏳ *{faltam}* more referrals to withdraw.`,
    es: `⏳ Faltan *{faltam}* referidos para retirar.`,
    fr: `⏳ Il manque *{faltam}* parrainages pour retirer.`,
    de: `⏳ Noch *{faltam}* Empfehlungen bis zur Auszahlung.`,
    it: `⏳ Mancano *{faltam}* riferimenti per prelevare.`,
    ru: `⏳ Ещё *{faltam}* рефералов до вывода.`,
    uk: `⏳ Ще *{faltam}* рефералів до виведення.`,
    ar: `⏳ تحتاج *{faltam}* إحالات إضافية للسحب.`,
    zh: `⏳ 还需 *{faltam}* 次推荐才能提现。`,
    hi: `⏳ निकासी के लिए *{faltam}* और रेफरल चाहिए।`,
    tr: `⏳ Çekim için *{faltam}* yönlendirme daha gerekiyor.`,
    id: `⏳ Butuh *{faltam}* referral lagi untuk withdraw.`,
  },

  // ── Keyboards (botões) ───────────────────────────────────────────────

  btn_balance:       { pt: '💰 Saldo & Carteira', en: '💰 Balance & Wallet',    es: '💰 Saldo & Cartera',  fr: '💰 Solde & Portefeuille', de: '💰 Guthaben & Wallet', it: '💰 Saldo & Portafoglio', ru: '💰 Баланс',      uk: '💰 Баланс',       ar: '💰 الرصيد',     zh: '💰 余额与钱包', hi: '💰 बैलेंस',    tr: '💰 Bakiye',     id: '💰 Saldo'         },
  btn_tasks:         { pt: '📋 Ver Tarefas',       en: '📋 View Tasks',          es: '📋 Ver Tareas',       fr: '📋 Voir Tâches',          de: '📋 Aufgaben',          it: '📋 Attività',           ru: '📋 Задания',     uk: '📋 Завдання',    ar: '📋 المهام',     zh: '📋 查看任务', hi: '📋 कार्य',      tr: '📋 Görevler',   id: '📋 Lihat Tugas'  },
  btn_create:        { pt: '➕ Criar Tarefa',       en: '➕ Create Task',          es: '➕ Crear Tarea',       fr: '➕ Créer Tâche',           de: '➕ Aufgabe erstellen',  it: '➕ Crea Attività',      ru: '➕ Создать',     uk: '➕ Створити',    ar: '➕ إنشاء مهمة', zh: '➕ 创建任务', hi: '➕ कार्य बनाएं', tr: '➕ Görev Oluştur', id: '➕ Buat Tugas' },
  btn_referral:      { pt: '👥 Referral',           en: '👥 Referral',            es: '👥 Referidos',        fr: '👥 Parrainage',            de: '👥 Empfehlung',         it: '👥 Riferimento',        ru: '👥 Рефералы',   uk: '👥 Реферали',   ar: '👥 الإحالات',  zh: '👥 推荐',     hi: '👥 रेफरल',     tr: '👥 Yönlendirme', id: '👥 Referral'    },
  btn_my_tasks:      { pt: '📁 Minhas Tarefas',     en: '📁 My Tasks',            es: '📁 Mis Tareas',       fr: '📁 Mes Tâches',           de: '📁 Meine Aufgaben',    it: '📁 Le Mie Attività',   ru: '📁 Мои задания', uk: '📁 Мої завдання', ar: '📁 مهامي',   zh: '📁 我的任务', hi: '📁 मेरे कार्य', tr: '📁 Görevlerim', id: '📁 Tugas Saya' },
  btn_help:          { pt: '❓ Ajuda',              en: '❓ Help',                es: '❓ Ayuda',             fr: '❓ Aide',                  de: '❓ Hilfe',              it: '❓ Aiuto',               ru: '❓ Помощь',      uk: '❓ Допомога',   ar: '❓ مساعدة',    zh: '❓ 帮助',     hi: '❓ सहायता',    tr: '❓ Yardım',     id: '❓ Bantuan'      },
  btn_back:          { pt: '◀️ Voltar',             en: '◀️ Back',               es: '◀️ Volver',           fr: '◀️ Retour',               de: '◀️ Zurück',            it: '◀️ Indietro',           ru: '◀️ Назад',      uk: '◀️ Назад',     ar: '◀️ رجوع',     zh: '◀️ 返回',    hi: '◀️ वापस',      tr: '◀️ Geri',      id: '◀️ Kembali'     },
  btn_main_menu:     { pt: '◀️ Menu Principal',     en: '◀️ Main Menu',          es: '◀️ Menú Principal',   fr: '◀️ Menu Principal',       de: '◀️ Hauptmenü',         it: '◀️ Menu Principale',   ru: '◀️ Главное меню', uk: '◀️ Головне меню', ar: '◀️ القائمة الرئيسية', zh: '◀️ 主菜单', hi: '◀️ मुख्य मेनू', tr: '◀️ Ana Menü', id: '◀️ Menu Utama' },
  btn_deposit:       { pt: '💰 Depositar TON',      en: '💰 Deposit TON',        es: '💰 Depositar TON',    fr: '💰 Déposer des TON',      de: '💰 TON einzahlen',     it: '💰 Deposita TON',      ru: '💰 Пополнить',  uk: '💰 Поповнити',  ar: '💰 إيداع',     zh: '💰 充值',     hi: '💰 जमा करें',  tr: '💰 TON Yatır',  id: '💰 Deposit TON' },
  btn_withdraw:      { pt: '💸 Sacar TON',          en: '💸 Withdraw TON',       es: '💸 Retirar TON',      fr: '💸 Retirer des TON',      de: '💸 TON auszahlen',     it: '💸 Preleva TON',       ru: '💸 Вывести',    uk: '💸 Вивести',    ar: '💸 سحب',       zh: '💸 提现',     hi: '💸 निकालें',   tr: '💸 TON Çek',    id: '💸 Tarik TON'   },
  btn_cancel:        { pt: '❌ Cancelar',            en: '❌ Cancel',              es: '❌ Cancelar',          fr: '❌ Annuler',               de: '❌ Abbrechen',          it: '❌ Annulla',             ru: '❌ Отмена',      uk: '❌ Скасувати',  ar: '❌ إلغاء',     zh: '❌ 取消',     hi: '❌ रद्द करें', tr: '❌ İptal',      id: '❌ Batal'        },
  btn_accept_task:   { pt: '✅ Aceitar tarefa',      en: '✅ Accept task',         es: '✅ Aceptar tarea',    fr: '✅ Accepter la tâche',    de: '✅ Aufgabe annehmen',   it: '✅ Accetta attività',   ru: '✅ Принять',     uk: '✅ Прийняти',   ar: '✅ قبول المهمة', zh: '✅ 接受任务', hi: '✅ कार्य स्वीकारें', tr: '✅ Görevi Kabul Et', id: '✅ Terima Tugas' },
  btn_submit_task:   { pt: '📤 Submeter para revisão', en: '📤 Submit for review', es: '📤 Enviar a revisión', fr: '📤 Soumettre pour révision', de: '📤 Zur Prüfung einreichen', it: '📤 Invia per revisione', ru: '📤 Отправить на проверку', uk: '📤 Надіслати на перевірку', ar: '📤 إرسال للمراجعة', zh: '📤 提交审核', hi: '📤 समीक्षा हेतु सबमिट', tr: '📤 İncelemeye Gönder', id: '📤 Submit Review' },
  btn_approve:       { pt: '✅ Aprovar',             en: '✅ Approve',             es: '✅ Aprobar',           fr: '✅ Approuver',             de: '✅ Genehmigen',         it: '✅ Approva',             ru: '✅ Одобрить',    uk: '✅ Затвердити', ar: '✅ موافقة',     zh: '✅ 批准',     hi: '✅ अनुमोदित',  tr: '✅ Onayla',     id: '✅ Setujui'      },
  btn_dispute:       { pt: '⚠️ Disputar',            en: '⚠️ Dispute',            es: '⚠️ Disputar',         fr: '⚠️ Contester',            de: '⚠️ Anfechten',         it: '⚠️ Disputa',            ru: '⚠️ Оспорить',   uk: '⚠️ Оскаржити', ar: '⚠️ نزاع',      zh: '⚠️ 争议',    hi: '⚠️ विवाद',     tr: '⚠️ İtiraz Et', id: '⚠️ Sengketa'    },
  btn_share_link:    { pt: '📤 Partilhar link',      en: '📤 Share link',         es: '📤 Compartir enlace', fr: '📤 Partager le lien',     de: '📤 Link teilen',       it: '📤 Condividi link',     ru: '📤 Поделиться', uk: '📤 Поділитись', ar: '📤 مشاركة الرابط', zh: '📤 分享链接', hi: '📤 लिंक शेयर', tr: '📤 Linki Paylaş', id: '📤 Bagikan Link' },
};

// ═══════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detecta o locale a partir do objecto `from` do Telegram.
 * `from.language_code` é preenchido automaticamente pelo cliente Telegram
 * com o idioma do dispositivo do utilizador (ex: "pt", "en-US", "ru").
 *
 * @param {object} from  - Objecto `from` da mensagem Telegram
 * @returns {string}     - Código de locale interno (ex: "pt", "en")
 */
function lang(from) {
  if (!from?.language_code) return DEFAULT_LANG;
  const raw = from.language_code.toLowerCase().trim();
  return LANG_MAP[raw] || LANG_MAP[raw.split('-')[0]] || DEFAULT_LANG;
}

/**
 * Traduz uma chave para o locale indicado, substituindo variáveis.
 *
 * @param {string} locale    - Código de locale (resultado de `lang()`)
 * @param {string} key       - Chave de tradução (ex: 'welcome_new')
 * @param {object} [vars={}] - Variáveis dinâmicas (ex: { nome: 'João' })
 * @returns {string}         - String traduzida com variáveis substituídas
 */
function t(locale, key, vars = {}) {
  const group = STRINGS[key];
  if (!group) {
    console.warn(`[i18n] chave desconhecida: "${key}"`);
    return key;
  }
  // Fallback: locale pedido → pt (padrão) → chave literal
  const template = group[locale] || group[DEFAULT_LANG] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

/**
 * Traduz um botão de teclado inline.
 *
 * @param {string} locale - Código de locale
 * @param {string} key    - Chave do botão (ex: 'btn_back')
 * @returns {string}      - Texto do botão traduzido
 */
function btn(locale, key) {
  return t(locale, key);
}



// ── Env ───────────────────────────────────────────────────────────────
const BOT_TOKEN    = process.env.BOT_TOKEN;
const PORT         = parseInt(process.env.PORT || '3000', 10);
const ADMIN_ID     = 7991785009;
const BOT_USERNAME = (process.env.BOT_USERNAME || 'TaskMarket_Bot').trim();
const RENDER_URL   = (process.env.RENDER_EXTERNAL_URL || '').trim();
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;
const XROCKET_WEBHOOK_PATH = '/bsc-webhook';
const BSC_API_KEY   = process.env.BSC_API_KEY || '';   // chave BSCScan API (opcional)

// ── Supabase ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Constantes (valores em USD — convertidos para BNB em runtime) ─────
const REFERRAL_BONUS_USD    = 0.01;  // $0.01 por referência
const LISTING_FEE_USD       = 0.10;  // $0.10 taxa de listagem
const MIN_WITHDRAW_USD      = 1.00;  // $1.00 mínimo de saque
const MIN_REFS_WITHDRAW     = 100;   // nº mínimo de referências para sacar
const TASKS_PER_PAGE        = 5;
const DEPOSIT_AMOUNTS_USD   = [1, 2, 5, 10, 20]; // valores de depósito em USD
const BSC_RECEIVER_ADDRESS  = '0xfa80431966FD890F562C68Eb3cC2a0692760A159';

// ── Cache do preço BNB/USD ─────────────────────────────────────────────
// Actualizado a cada 5 minutos via CoinGecko (sem API key necessária).
let _bnbPriceUsd    = 600;   // fallback conservador
let _bnbPriceFetchedAt = 0;
const BNB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getBnbPrice() {
  const now = Date.now();
  if (now - _bnbPriceFetchedAt < BNB_CACHE_TTL_MS) return _bnbPriceUsd;
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.coingecko.com',
      path:     '/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
      method:   'GET',
      headers:  { 'Accept': 'application/json' },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const price = data?.binancecoin?.usd;
          if (price && price > 0) {
            _bnbPriceUsd    = price;
            _bnbPriceFetchedAt = Date.now();
            console.log(`[bnb:price] ✅ $${price}`);
          }
        } catch (e) { console.warn('[bnb:price] parse error:', e.message); }
        resolve(_bnbPriceUsd);
      });
    });
    req.on('error', e => { console.warn('[bnb:price] fetch error:', e.message); resolve(_bnbPriceUsd); });
    req.end();
  });
}

/** Converte USD → BNB usando preço em cache. Arredonda a 8 casas. */
async function usdToBnb(usd) {
  const price = await getBnbPrice();
  return parseFloat((usd / price).toFixed(8));
}

/** Atalho: retorna o preço BNB actual sem async overhead se já em cache. */
function bnbPriceCached() { return _bnbPriceUsd; }

// Aliases de compatibilidade (valores BNB calculados em runtime via usdToBnb)
// Usado apenas onde precisamos de um valor síncrono de fallback.
const LISTING_FEE = LISTING_FEE_USD;   // será convertido em runtime
const REFERRAL_BONUS = REFERRAL_BONUS_USD; // idem
const FSM_TIMEOUT_MS        = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS  = 60 * 60 * 1000;
const PENDING_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

// ── Tarefas nativas — publicidade ────────────────────────────────────
const PROMO_TASK = {
  id:          'promo_sweetcoin',
  title:       'Ganha Dinheiro Real Só por Caminhar!',
  task_type:   'promo',
  reward:      0.01,
  description:
    'Transforma cada passo em recompensas com Sweetcoin.\n\n' +
    '🔥 Desafio Ultimate:\n' +
    'Convida 20 amigos e recebe $10 diretamente no teu PayPal!\n' +
    'Quanto mais caminhas e convidas, mais ganhas.\n\n' +
    '👉 Começa agora com o meu link:\n' +
    'https://swcapp.com/i/orlandojaime27142264868',
  target_link:     'https://swcapp.com/i/orlandojaime27142264868',
  slots_remaining: 9999,
  status:          'open',
  is_promo:        true,
};

const PROMO_TASK_2 = {
  id:          'promo_daminexs',
  title:       'Ganha USDT — Convida Amigos para o Daminexs!',
  task_type:   'promo',
  reward:      0.01,
  description:
    'Junta-te ao Daminexs e ganha USDT por convidar amigos!\n\n' +
    '👥 Cada amigo convidado = *+0.02 USDT*\n' +
    '💸 Levantamento mínimo: *0.20 USDT*\n\n' +
    '👉 Começa agora com o meu link:\n' +
    'https://t.me/daminexs_bot?start=r00914962806',
  target_link:     'https://t.me/daminexs_bot?start=r00914962806',
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
console.log(`  BSC Rx  : ${BSC_RECEIVER_ADDRESS}`);
console.log(`  Admin   : ${ADMIN_ID}`);
console.log('══════════════════════════════════════════════════\n');

if (!BOT_TOKEN)                        { console.error('FATAL: BOT_TOKEN em falta');            process.exit(1); }
if (!process.env.SUPABASE_URL)         { console.error('FATAL: SUPABASE_URL em falta');         process.exit(1); }
if (!process.env.SUPABASE_SERVICE_KEY) { console.error('FATAL: SUPABASE_SERVICE_KEY em falta'); process.exit(1); }

// ═══════════════════════════════════════════════════════════════════════
// STATE — FSM por utilizador
// ═══════════════════════════════════════════════════════════════════════
const userState = new Map();
// Referral pendente: tg_id → referrerTelegramId (gravado em 0ms no /start)
const pendingReferrals = new Map();

function getState(tid)        { return userState.get(tid) || null; }
function setState(tid, state) { userState.set(tid, { ...state, createdAt: Date.now() }); }
function clearState(tid)      { userState.delete(tid); }

function sweepExpiredStates() {
  const now = Date.now();
  for (const [tid, state] of userState.entries()) {
    if (now - (state.createdAt || 0) > FSM_TIMEOUT_MS) {
      userState.delete(tid);
      sendMessage(tid, t(DEFAULT_LANG, 'session_expired')).catch(() => {});
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

// ═══════════════════════════════════════════════════════════════════════
// BSC PAYMENT HELPERS
// Pagamentos via BNB na BSC.
// Depósitos: utilizador envia BNB para BSC_RECEIVER_ADDRESS.
// O bot verifica via BSCScan API ou webhook externo.
// Saques: o admin processa manualmente ou via script externo.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Gera um identificador único de depósito para o utilizador.
 * O utilizador envia BNB para BSC_RECEIVER_ADDRESS com este memo
 * (ou inclui no memo via BSCScan input data).
 */
function generateDepositMemo(userId, amount) {
  return `TM-${userId.toString().slice(0,8)}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Verifica o saldo BNB de um endereço via BSCScan API.
 * Retorna o saldo em BNB (float) ou null em caso de erro.
 */
async function getBscBalance(address) {
  return new Promise((resolve) => {
    const path = `/api?module=account&action=balance&address=${address}&tag=latest` +
                 (BSC_API_KEY ? `&apikey=${BSC_API_KEY}` : '');
    const req = https.request({
      hostname: 'api.bscscan.com',
      path,
      method: 'GET',
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          if (r.status === '1') resolve(parseFloat(r.result) / 1e18);
          else resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Verifica transacções BNB recebidas pelo BSC_RECEIVER_ADDRESS
 * para detectar depósito de um utilizador.
 * Retorna lista de txs recentes ou [] em caso de erro.
 */
async function getBscIncomingTxs(startBlock = 0) {
  return new Promise((resolve) => {
    const path = `/api?module=account&action=txlist&address=${BSC_RECEIVER_ADDRESS}` +
                 `&startblock=${startBlock}&endblock=99999999&sort=desc` +
                 (BSC_API_KEY ? `&apikey=${BSC_API_KEY}` : '');
    const req = https.request({
      hostname: 'api.bscscan.com',
      path,
      method: 'GET',
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          resolve(r.status === '1' ? (r.result || []) : []);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

/**
 * Saque manual: registado na BD como pendente.
 * O admin processa o envio BNB externamente para o endereço do utilizador.
 * Retorna true (sempre aceita o pedido, processamento é manual).
 */
async function requestBscWithdrawal(userId, address, amount) {
  try {
    await logTx(userId, 'withdrawal_pending',
      -amount,
      `Saque BNB pendente → ${address} | processamento manual`
    );
    // Notifica admin
    await sendMessage(ADMIN_ID,
      `💸 *Pedido de saque BNB*\n\nUser ID: \`${userId}\`\nEndereço: \`${address}\`\nValor: *${amount} BNB*\n\n⚠️ Processar manualmente na BSC.`,
      { parse_mode: 'Markdown' }
    );
    return true;
  } catch (e) {
    console.error('[bsc:withdrawal]', e.message);
    return false;
  }
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

// getOrCreateUser — estratégia premium com 3 camadas
// Camada 1: pendingReferrals gravado em 0ms no /start (síncrono)
// Camada 2: registo + referral em background no /start
// Camada 3: se user clicar antes do background terminar,
//           getOrCreateUser aplica o referral pendente aqui
async function getOrCreateUser(from) {
  let user = await getUser(from.id);
  if (!user) {
    try { user = await createUser(from); } catch (_) { user = await getUser(from.id); }
    if (user) {
      const refTgId = pendingReferrals.get(from.id);
      if (refTgId && refTgId !== from.id) {
        pendingReferrals.delete(from.id);
        try {
          const referrer = await getUser(refTgId);
          if (referrer && !user.referred_by) {
            await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id);
            await processReferral(refTgId, user.id, from);
            console.log(`[getOrCreateUser] referral recuperado tg=${from.id} → referrer.id=${referrer.id}`);
          }
        } catch (e) { console.error('[getOrCreateUser:referral]', e.message); }
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

// processReferral — referrerTelegramId é número; newUserId é UUID da BD
async function processReferral(referrerTelegramId, newUserId, from) {
  if (!referrerTelegramId || referrerTelegramId === from.id) return;
  const referrer = await getUser(referrerTelegramId);
  if (!referrer) { console.warn(`[referral] referrer tg=${referrerTelegramId} não encontrado`); return; }

  // Verificação de duplicado por UUID (nunca telegram_id)
  const { data: dup } = await supabase.from('referrals').select('id')
    .eq('referrer_id', referrer.id).eq('referred_id', newUserId).maybeSingle();
  if (dup) { console.warn(`[referral] duplicado ignorado referrer=${referrer.id} referred=${newUserId}`); return; }

  const novoCount   = (referrer.referral_count || 0) + 1;
  const bonusBnb    = await usdToBnb(REFERRAL_BONUS_USD);
  const bnbPrice    = bnbPriceCached();

  // Update pelo UUID — nunca pelo telegram_id
  await supabase.from('users').update({
    balance: parseFloat(((referrer.balance || 0) + bonusBnb).toFixed(8)),
    referral_count: novoCount,
  }).eq('id', referrer.id);

  // Insere referral com UUIDs correctos
  await supabase.from('referrals').insert({
    referrer_id: referrer.id, referred_id: newUserId,
    bonus_paid: bonusBnb, created_at: new Date().toISOString(),
  });

  await logTx(referrer.id, 'referral', bonusBnb,
    `Referência: @${from.username || from.first_name || from.id}`);

  console.log(`[referral] ✅ referrer.id=${referrer.id} tg=${referrerTelegramId} count=${novoCount} referred=${newUserId} bonus=${bonusBnb} BNB ($${REFERRAL_BONUS_USD})`);

  const faltam = MIN_REFS_WITHDRAW - novoCount;
  await sendMessage(referrerTelegramId,
    `🎉 *Nova referência!*\n\n` +
    `@${from.username || from.first_name || 'utilizador'} entrou pelo teu link.\n` +
    `💎 *+${bonusBnb} BNB* (~$${REFERRAL_BONUS_USD}) creditado!\n` +
    `📊 *${novoCount}/${MIN_REFS_WITHDRAW}* referências\n` +
    `💱 Preço BNB: *$${bnbPrice}*\n\n` +
    (faltam <= 0 ? `✅ Atingiste o mínimo! Usa /sacar.` : `⏳ Faltam *${faltam}* para sacar.`),
    { parse_mode: 'Markdown' }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════

const KB = {
  mainMenu: (lc = DEFAULT_LANG) => ({
    inline_keyboard: [
      [{ text: t(lc,'btn_balance'),  callback_data: 'menu_saldo'    },
       { text: t(lc,'btn_tasks'),    callback_data: 'menu_tarefas'  }],
      [{ text: t(lc,'btn_create'),   callback_data: 'menu_criar'    },
       { text: t(lc,'btn_referral'), callback_data: 'menu_referral' }],
      [{ text: t(lc,'btn_my_tasks'), callback_data: 'menu_minhas'   },
       { text: t(lc,'btn_help'),     callback_data: 'menu_ajuda'    }],
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
      rows.push([{ text: '🌟 [PROMO] Ganha Dinheiro Só por Caminhar!', callback_data: 'task_view_promo_sweetcoin' }]);
      rows.push([{ text: '🌟 [PROMO] Ganha USDT — Daminexs!', callback_data: 'task_view_promo_daminexs' }]);
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

  backToMenu:  (lc = DEFAULT_LANG) => ({ inline_keyboard: [[{ text: t(lc,'btn_main_menu'), callback_data: 'menu_main' }]] }),
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
    ? parseInt(rawPayload.slice(1), 10) : null;

  console.log(`[/start] tg=${from.id} @${from.username || '—'} ref=${referrerTelegramId || '—'}`);

  clearState(from.id);

  // ── CAMADA 1 (0ms, síncrono) ─────────────────────────────────────────
  // Grava referral em memória ANTES de qualquer I/O.
  // Garante que getOrCreateUser pode aplicá-lo mesmo se o user
  // clicar num botão antes do background terminar.
  if (referrerTelegramId && referrerTelegramId !== from.id) {
    pendingReferrals.set(from.id, referrerTelegramId);
  }

  // ── CAMADA 2 — menu imediato ─────────────────────────────────────────
  const nome = from.first_name || 'utilizador';
  const _locale0 = lang(from);
  await sendMessage(chatId,
    t(_locale0, 'inicio_menu', { nome }),
    { parse_mode: 'Markdown', reply_markup: KB.mainMenu(_locale0) }
  ).catch(() => {});

  // ── CAMADA 3 — registo + referral em background ──────────────────────
  try {
    let user = await getUser(from.id);
    const isNew = !user;

    if (isNew) {
      user = await createUser(from);
      console.log(`[/start] novo user: id=${user.id} tg=${from.id}`);
    } else {
      updateUserProfile(from).catch(() => {});
    }

    // Processa referral (novo user ou retroactivo)
    if (referrerTelegramId && referrerTelegramId !== from.id && !user.referred_by) {
      const referrer = await getUser(referrerTelegramId);
      if (referrer) {
        await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id);
        await processReferral(referrerTelegramId, user.id, from);
      }
      pendingReferrals.delete(from.id); // consumido com sucesso
    } else {
      pendingReferrals.delete(from.id); // limpa se já tinha referred_by
    }

    if (isNew) {
      await sendMessage(chatId,
        t(_locale0, 'account_created', { bonus: REFERRAL_BONUS, minRefs: MIN_REFS_WITHDRAW }),
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[/start:bg] ❌', err.message, err.code || '');
    // pendingReferrals mantém-se — getOrCreateUser aplica-o quando necessário
  }
}

// ── /inicio — substituto robusto do /start ───────────────────────────
// Não falha se o utilizador não estiver registado.
// Regista em background, mostra sempre o menu.
// Capta referral em 3 cenários:
//   1. Utilizador novo       → cria conta + processa bónus
//   2. Existente sem ref     → atribui referral retroactivamente
// handleInicio — delega para handleStart (lógica unificada)
async function handleInicio(msg) { return handleStart(msg); }

async function handleSaldo(msg) {
  const user      = await getOrCreateUser(msg.from);
  const locale    = lang(msg.from);
  const refs      = user.referral_count || 0;
  const saldoBnb  = (user.balance || 0);
  const bnbPrice  = await getBnbPrice();
  const saldoUsd  = (saldoBnb * bnbPrice).toFixed(2);
  const minWithdrawBnb = await usdToBnb(MIN_WITHDRAW_USD);
  const prog      = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar       = '█'.repeat(prog) + '░'.repeat(10 - prog);
  const statusLine = refs >= MIN_REFS_WITHDRAW
    ? t(locale, 'balance_withdraw_ready')
    : t(locale, 'balance_need_more', { faltam: MIN_REFS_WITHDRAW - refs });
  await sendMessage(msg.chat.id,
    `💎 *Carteira TaskMarket*\n\n` +
    `Saldo: *${saldoBnb.toFixed(8)} BNB*\n` +
    `≈ *$${saldoUsd} USD*\n` +
    `💱 Preço BNB: *$${bnbPrice}*\n\n` +
    `👥 Referências: *${refs}/${MIN_REFS_WITHDRAW}*\n${bar}\n\n` +
    `Mínimo de saque: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD})\n\n` +
    statusLine,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(locale,'btn_deposit'), callback_data: 'menu_depositar' },
           { text: t(locale,'btn_withdraw'), callback_data: 'menu_sacar'   }],
          [{ text: t(locale,'btn_main_menu'), callback_data: 'menu_main'   }],
        ]
      }
    }
  );
}

// ── Contador de sessões de depósito por utilizador (para gerar valor único) ──
const _depositSeqMap = new Map(); // userId → seq (1..999)
function nextDepositSeq(userId) {
  const seq = (_depositSeqMap.get(userId) || 0) + 1;
  _depositSeqMap.set(userId, seq % 1000);
  return seq;
}

/**
 * Estratégia Binance: cada sessão de depósito usa um montante BNB único.
 * Ex: o utilizador quer depositar $5 → BNB equivalente + 0.000001 * seq
 * O bot faz polling BSCScan e identifica o TX pelo montante exacto.
 */
async function generateUniqueDepositAmount(usdAmount, userId) {
  const bnbBase = await usdToBnb(usdAmount);
  const seq     = nextDepositSeq(userId);
  // Adiciona centésimos de satoshi para tornar o valor único sem impacto perceptível
  const unique  = parseFloat((bnbBase + seq * 0.000001).toFixed(8));
  return unique;
}

// Map: invoiceId (nossa chave local) → dados da sessão de depósito
const pendingBscDeposits = new Map();

async function handleDepositar(msg) {
  const user   = await getOrCreateUser(msg.from);
  const locale = lang(msg.from);
  // Mostra menu de valores USD para escolher
  await sendMessage(msg.chat.id,
    `💰 *Depositar BNB (BSC)*\n\nEscolhe o valor a depositar:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          DEPOSIT_AMOUNTS_USD.slice(0,3).map(a => ({ text: `$${a}`, callback_data: `dep_usd_${a}` })),
          DEPOSIT_AMOUNTS_USD.slice(3).map(a =>   ({ text: `$${a}`, callback_data: `dep_usd_${a}` })),
          [{ text: '✏️ Outro valor', callback_data: 'dep_custom' }],
          [{ text: '◀️ Voltar', callback_data: 'menu_saldo' }],
        ]
      }
    }
  );
}

/**
 * Inicia o fluxo de depósito automático BSC para um dado valor USD.
 * Gera montante BNB único, persiste na BD e arranca polling BSCScan.
 */
async function startBscDepositFlow(chatId, from, usdAmount) {
  const user      = await getOrCreateUser(from);
  const bnbAmount = await generateUniqueDepositAmount(usdAmount, user.id);
  const bnbPrice  = bnbPriceCached();
  const invoiceId = `BSC-${user.id.slice(0,8)}-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  // Persiste na BD
  await supabase.from('deposit_invoices').insert({
    user_id: user.id, invoice_id: invoiceId,
    amount: bnbAmount, status: 'pending',
    created_at: new Date().toISOString(),
  }).catch(e => console.warn('[bsc:deposit:insert]', e.message));

  // Guarda em memória para polling
  pendingBscDeposits.set(invoiceId, {
    userId: user.id, telegramId: from.id, chatId,
    bnbAmount, usdAmount, expiresAt,
  });

  const expireTime = new Date(expiresAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  const sentMsg = await sendMessage(chatId,
    `💰 *Depósito BSC — Automático*\n\n` +
    `Valor a depositar (montante exacto):\n` +
    `\`\`\`\n${bnbAmount} BNB\n\`\`\`\n` +
    `≈ *$${usdAmount} USD* (BNB: $${bnbPrice})\n\n` +
    `Para o endereço:\n` +
    `\`${BSC_RECEIVER_ADDRESS}\`\n\n` +
    `⚠️ *Envia EXACTAMENTE este valor de BNB*\n` +
    `É assim que o bot te identifica automaticamente.\n\n` +
    `✅ Rede: *BSC (BEP-20)*\n` +
    `⏱ Expira às *${expireTime}*\n\n` +
    `_O saldo é creditado automaticamente após confirmação na blockchain._`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Verificar agora', callback_data: `dep_bsc_check_${invoiceId}` }],
          [{ text: '❌ Cancelar', callback_data: `dep_bsc_cancel_${invoiceId}` }],
        ]
      }
    }
  );

  const msgId = sentMsg.result?.message_id;
  // Guarda msgId para editar depois
  const entry = pendingBscDeposits.get(invoiceId);
  if (entry) { entry.msgId = msgId; pendingBscDeposits.set(invoiceId, entry); }

  // Arranca polling BSCScan a cada 30s
  startBscDepositPolling(invoiceId);
  console.log(`[bsc:deposit] started invoiceId=${invoiceId} user=${user.id} amount=${bnbAmount} BNB`);
}

// ── BSCScan polling ─────────────────────────────────────────────────────────
// Verifica transacções recebidas pelo BSC_RECEIVER_ADDRESS e faz match por
// montante exacto (estratégia Binance).

// Cache do último bloco verificado para reduzir resposta BSCScan
let _lastCheckedBlock = 0;

async function checkBscDepositsOnce() {
  if (pendingBscDeposits.size === 0) return;

  let txs = [];
  try {
    txs = await getBscIncomingTxs(_lastCheckedBlock);
  } catch (e) {
    console.warn('[bsc:poll] getBscIncomingTxs error:', e.message);
    return;
  }

  if (!txs.length) return;

  // Actualiza bloco mais recente visto
  const maxBlock = Math.max(...txs.map(tx => parseInt(tx.blockNumber, 10) || 0));
  if (maxBlock > _lastCheckedBlock) _lastCheckedBlock = maxBlock;

  const now = Date.now();

  for (const [invoiceId, entry] of pendingBscDeposits.entries()) {
    // Expirou?
    if (new Date(entry.expiresAt).getTime() < now) {
      pendingBscDeposits.delete(invoiceId);
      await supabase.from('deposit_invoices').update({ status: 'expired' }).eq('invoice_id', invoiceId);
      if (entry.chatId && entry.msgId) {
        await editMessage(entry.chatId, entry.msgId,
          `⏱ *Depósito expirado.*\n\nCria um novo com /depositar.`,
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
        ).catch(() => {});
      }
      continue;
    }

    // Procura TX com montante exacto (tolerância de 1 satoshi = 0.000000001)
    const matchTx = txs.find(tx => {
      if (tx.to?.toLowerCase() !== BSC_RECEIVER_ADDRESS.toLowerCase()) return false;
      const txBnb = parseFloat(tx.value) / 1e18;
      return Math.abs(txBnb - entry.bnbAmount) < 0.000000002;
    });

    if (matchTx) {
      pendingBscDeposits.delete(invoiceId);
      try {
        const newBalance = await creditDepositIdempotent(entry.userId, entry.bnbAmount, invoiceId);
        if (newBalance === null) continue; // duplo — já pago
        console.log(`[bsc:poll] ✅ matched invoiceId=${invoiceId} user=${entry.userId} tx=${matchTx.hash}`);
        if (entry.chatId && entry.msgId) {
          await editMessage(entry.chatId, entry.msgId,
            `✅ *Depósito confirmado!*\n\n` +
            `*+${entry.bnbAmount} BNB* (~$${entry.usdAmount}) adicionado.\n` +
            `Novo saldo: *${newBalance.toFixed(8)} BNB*\n\n` +
            `TX: \`${matchTx.hash.slice(0,18)}…\``,
            { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
          ).catch(() => {});
        }
      } catch (e) {
        console.error('[bsc:poll:credit]', e.message);
      }
    }
  }
}

function startBscDepositPolling(invoiceId) {
  // Polling global já está a correr — não precisamos de timer individual
  // O checkBscDepositsOnce() cobre todos os pendentes
}

// ── Polling global BSCScan — corre a cada 30 segundos ───────────────────────
function startGlobalBscPolling() {
  setInterval(() => checkBscDepositsOnce().catch(e => console.error('[bsc:global:poll]', e.message)), 30_000);
  console.log('[bsc:poll] ✅ polling global iniciado (30s)');
}

async function handleSacar(msg) {
  const user           = await getOrCreateUser(msg.from);
  const locale_sacar   = lang(msg.from);
  const saldoBnb       = user.balance || 0;
  const bnbPrice       = await getBnbPrice();
  const minWithdrawBnb = await usdToBnb(MIN_WITHDRAW_USD);

  if (saldoBnb < minWithdrawBnb) {
    return sendMessage(msg.chat.id,
      `❌ *Saldo insuficiente para saque*\n\n` +
      `Saldo: *${saldoBnb.toFixed(8)} BNB* (~$${(saldoBnb * bnbPrice).toFixed(2)})\n` +
      `Mínimo de saque: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD})\n\n` +
      `Deposita com /depositar para continuar.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale_sacar) }
    );
  }

  setState(msg.from.id, { step: 'withdraw_amount', locale: locale_sacar, minWithdrawBnb });
  await sendMessage(msg.chat.id,
    `💸 *Saque BNB*\n\n` +
    `Saldo: *${saldoBnb.toFixed(8)} BNB* (~$${(saldoBnb * bnbPrice).toFixed(2)})\n` +
    `💱 Preço BNB actual: *$${bnbPrice}*\n\n` +
    `Mínimo de saque: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD})\n\n` +
    `Envia o valor em BNB que queres sacar:`,
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
    ? `🌟 *[PROMO]* Ganha Dinheiro Só por Caminhar! — *0.01 TON*\n   _Validação automática em 1h · Sweetcoin_\n\n` +
      `🌟 *[PROMO]* Ganha USDT — Daminexs! — *0.01 TON*\n   _Validação automática em 1h · Daminexs_\n\n`
    : '';

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
  const user         = await getOrCreateUser(msg.from);
  const listingBnb   = await usdToBnb(LISTING_FEE_USD);
  const bnbPrice     = bnbPriceCached();
  if ((user.balance || 0) < listingBnb) {
    return sendMessage(msg.chat.id,
      `❌ *Saldo insuficiente*\n\n` +
      `Taxa de listagem: *${listingBnb} BNB* (~$${LISTING_FEE_USD})\n` +
      `Saldo: *${(user.balance||0).toFixed(8)} BNB*\n\n` +
      `Deposita com /depositar.`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  }
  setState(msg.from.id, { step: 'create_type', userId: user.id, listingBnb });
  await sendMessage(msg.chat.id,
    `➕ *Criar Nova Tarefa*\n\n` +
    `Saldo: *${(user.balance||0).toFixed(8)} BNB* (~$${((user.balance||0) * bnbPrice).toFixed(2)})\n` +
    `💱 Preço BNB: *$${bnbPrice}*\n\n` +
    `🏷 *Taxa de listagem: ${listingBnb} BNB* (~$${LISTING_FEE_USD})\n\n` +
    `Escolhe o *tipo* de tarefa:`,
    { parse_mode: 'Markdown', reply_markup: KB.taskTypes() }
  );
}

async function handleReferral(msg) {
  const user     = await getOrCreateUser(msg.from);
  const link     = `https://t.me/${BOT_USERNAME}?start=r${msg.from.id}`;
  const refs     = user.referral_count || 0;
  const bnbPrice = await getBnbPrice();
  const bonusBnb = await usdToBnb(REFERRAL_BONUS_USD);
  const earned   = (refs * bonusBnb).toFixed(8);
  const earnedUsd = (refs * REFERRAL_BONUS_USD).toFixed(2);
  const prog     = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar      = '█'.repeat(prog) + '░'.repeat(10 - prog);

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
    `📊 *${refs}/${MIN_REFS_WITHDRAW}* referências\n` +
    `💎 *${earned} BNB* (~$${earnedUsd}) ganhos` +
    leaderboard +
    `\n\n_Cada referência = +${bonusBnb} BNB (~$${REFERRAL_BONUS_USD})_\n` +
    `_${MIN_REFS_WITHDRAW} refs para sacar mínimo $${MIN_WITHDRAW_USD}_\n` +
    `_💱 BNB actual: $${bnbPrice}_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Partilhar link', switch_inline_query: `Junta-te ao TaskMarket e ganha BNB! ${link}` }],
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

async function handleAjuda(chatId, from) {
  const locale = from ? lang(from) : DEFAULT_LANG;
  await sendMessage(chatId,
    t(locale, 'help_text', { minRefs: MIN_REFS_WITHDRAW }),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) }
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
  if (data === 'menu_main')     return editMessage(chatId, msgId, t(lang(from), 'inicio_menu', { nome: from.first_name || '' }), { parse_mode: 'Markdown', reply_markup: KB.mainMenu(lang(from)) });
  if (data === 'menu_saldo')    return handleSaldo({ chat: { id: chatId }, from });
  if (data === 'menu_depositar')return handleDepositar({ chat: { id: chatId }, from });
  if (data === 'menu_sacar')    return handleSacar({ chat: { id: chatId }, from });
  if (data === 'menu_tarefas')  return handleTarefas({ chat: { id: chatId }, from });
  if (data === 'menu_criar')    return handleCriar({ chat: { id: chatId }, from });
  if (data === 'menu_referral') return handleReferral({ chat: { id: chatId }, from });
  if (data === 'menu_minhas')   return handleMinhas({ chat: { id: chatId }, from });
  if (data === 'menu_ajuda')    return handleAjuda(chatId, from);

  // Admin — desactivado
  if (data === 'adm_menu' || data.startsWith('adm_') || data.startsWith('adm_fs_')) return;

  // Depósito BSC automático — valor personalizado
  if (data === 'dep_custom') {
    setState(from.id, { step: 'deposit_custom' });
    return sendMessage(chatId,
      `✏️ *Valor personalizado*\n\nEnvia o valor em USD (ex: \`3.5\`):`,
      { parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'dep_cancel' }]] } }
    );
  }

  // Depósito BSC automático — selecção de valor USD
  if (data.startsWith('dep_usd_')) {
    const usdAmount = parseFloat(data.replace('dep_usd_', ''));
    if (isNaN(usdAmount) || usdAmount <= 0) return;
    return startBscDepositFlow(chatId, from, usdAmount);
  }

  // Depósito BSC — verificação manual pelo utilizador
  if (data.startsWith('dep_bsc_check_')) {
    const invoiceId = data.replace('dep_bsc_check_', '');
    const entry     = pendingBscDeposits.get(invoiceId);
    if (!entry) {
      return answerCallback(cb.id, '⏱ Sessão expirada. Inicia um novo depósito.', true);
    }
    // Força verificação imediata
    await answerCallback(cb.id, '🔄 A verificar…');
    await checkBscDepositsOnce().catch(() => {});
    // Se ainda pendente, informa
    if (pendingBscDeposits.has(invoiceId)) {
      return sendMessage(chatId,
        `🔍 *A aguardar confirmação BSC…*\n\nAinda não detectamos o teu pagamento.\n_Certifica-te de enviar exactamente \`${entry.bnbAmount} BNB\`._`,
        { parse_mode: 'Markdown' }
      );
    }
    return; // já foi processado pelo checkBscDepositsOnce
  }

  // Depósito BSC — cancelar
  if (data.startsWith('dep_bsc_cancel_')) {
    const invoiceId = data.replace('dep_bsc_cancel_', '');
    pendingBscDeposits.delete(invoiceId);
    await supabase.from('deposit_invoices').update({ status: 'cancelled' }).eq('invoice_id', invoiceId);
    return sendMessage(chatId, '❌ Depósito cancelado.', { reply_markup: KB.backToMenu(lang(from)) });
  }

  // Depósito BSC — notificação manual (legado — mantido para compatibilidade)
  if (data.startsWith('dep_notify_')) {
    await answerCallback(cb.id, '✅ Já não é necessário — o bot detecta automaticamente!', true);
    return;
  }

  if (data === 'dep_cancel') {
    clearState(from.id);
    return sendMessage(chatId, t(lang(from), 'deposit_cancelled'), { reply_markup: KB.backToMenu(lang(from)) });
  }

  // Tarefas
  if (data.startsWith('tasks_page_')) return handleTarefas({ chat: { id: chatId }, from }, parseInt(data.replace('tasks_page_', ''), 10));

  if (data === 'task_view_promo_sweetcoin') {
    const user = await getOrCreateUser(from);

    // Verificar se já foi pago
    const { data: alreadyPaid } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .ilike('note', '%promo_sweetcoin%')
      .maybeSingle();

    if (alreadyPaid) {
      return sendMessage(chatId,
        `✅ *Já completaste esta tarefa!*\n\nA recompensa de *${PROMO_TASK.reward} TON* já foi creditada.`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
      );
    }

    // Agendar validação automática em 1h
    schedulePromoValidation(from.id, user.id, chatId);

    return sendMessage(chatId,
      `🌟 *Ganha Dinheiro Real Só por Caminhar!*\n\n` +
      `Transforma cada passo em recompensas com Sweetcoin.\n\n` +
      `🔥 *Desafio Ultimate:*\n` +
      `Convida 20 amigos e recebe $10 diretamente no teu PayPal!\n` +
      `Quanto mais caminhas e convidas, mais ganhas.\n\n` +
      `👉 *Começa agora com o meu link:*\n` +
      `https://swcapp.com/i/orlandojaime27142264868\n\n` +
      `⏱ _Clicaste no link. A tua recompensa de *${PROMO_TASK.reward} TON* será creditada automaticamente em *1 hora*._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👉 Começar agora — Sweetcoin', url: 'https://swcapp.com/i/orlandojaime27142264868' }],
            [{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }],
          ]
        }
      }
    );
  }

  if (data === 'task_view_promo_daminexs') {
    const user = await getOrCreateUser(from);

    const { data: alreadyPaid } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .ilike('note', '%promo_daminexs%')
      .maybeSingle();

    if (alreadyPaid) {
      return sendMessage(chatId,
        `✅ *Já completaste esta tarefa!*\n\nA recompensa de *${PROMO_TASK_2.reward} TON* já foi creditada.`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
      );
    }

    // Agendar validação automática em 1h (chave única por tarefa)
    const promoKey2 = from.id + '_daminexs';
    if (!pendingPromo.has(promoKey2)) {
      pendingPromo.set(promoKey2, { userId: user.id, chatId, acceptedAt: Date.now() });
      setTimeout(async () => {
        if (!pendingPromo.has(promoKey2)) return;
        pendingPromo.delete(promoKey2);
        try {
          const { data: dup } = await supabase.from('transactions').select('id')
            .eq('user_id', user.id).ilike('note', '%promo_daminexs%').maybeSingle();
          if (dup) return;
          const newBalance = await creditUser(user.id, PROMO_TASK_2.reward);
          await logTx(user.id, 'receipt', PROMO_TASK_2.reward, 'Tarefa promo_daminexs validada');
          await sendMessage(chatId,
            `✅ *Tarefa validada automaticamente!*\n\n"${PROMO_TASK_2.title}"\n💎 *+${PROMO_TASK_2.reward} TON* creditados!\nNovo saldo: *${newBalance.toFixed(4)} TON*`,
            { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
        } catch (e) { console.error('[promo2:auto]', e.message); }
      }, 60 * 60 * 1000);
    }

    return sendMessage(chatId,
      `🌟 *Ganha USDT — Convida Amigos para o Daminexs!*\n\n` +
      `Junta-te ao Daminexs e ganha USDT por convidar amigos!\n\n` +
      `👥 Cada amigo convidado = *+0.02 USDT*\n` +
      `💸 Levantamento mínimo: *0.20 USDT*\n\n` +
      `👉 *Começa agora com o meu link:*\n` +
      `https://t.me/daminexs_bot?start=r00914962806\n\n` +
      `⏱ _Clicaste no link. A tua recompensa de *${PROMO_TASK_2.reward} TON* será creditada automaticamente em *1 hora*._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👉 Começar agora — Daminexs', url: 'https://t.me/daminexs_bot?start=r00914962806' }],
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
  if (data === 'withdraw_cancel')  { clearState(from.id); return sendMessage(chatId, t(lang(from), 'withdraw_cancelled'), { reply_markup: KB.backToMenu(lang(from)) }); }
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
          t(DEFAULT_LANG, 'deposit_confirmed', { amount, saldo: newBalance.toFixed(4) }),
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
  const _loc_accept = lang(from);
  const _linkLine = task.target_link ? `🔗 ${task.target_link}\n\n` : '';
  await sendMessage(chatId,
    t(_loc_accept, 'task_accepted', { title: task.title, linkLine: _linkLine }),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(_loc_accept) });
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
  const _loc_sub = lang(from);
  await editMessage(chatId, msgId, t(_loc_sub, 'task_submitted'),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(_loc_sub) });
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
      const user       = await getUser(msg.from.id);
      const listingBnb = state.listingBnb || await usdToBnb(LISTING_FEE_USD);
      const bnbPrice   = bnbPriceCached();
      const totalCost  = parseFloat((state.reward * slots + listingBnb).toFixed(8));
      const saldo      = user?.balance || 0;
      setState(msg.from.id, { ...state, step: 'create_confirm', slots, totalCost, listingFee: listingBnb });
      if (saldo < totalCost) {
        clearState(msg.from.id);
        await sendMessage(chatId,
          `❌ *Saldo insuficiente*\n\n` +
          `Custo total: *${totalCost} BNB* (~$${(totalCost * bnbPrice).toFixed(2)})\n` +
          `Saldo: *${saldo.toFixed(8)} BNB*\n\nDeposita com /depositar.`,
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }); return true;
      }
      await sendMessage(chatId,
        `📋 *Confirma a tarefa*\n\n` +
        `${taskTypeEmoji(state.taskType)} *${taskTypeLabel(state.taskType)}*\n` +
        `📌 *${state.title}*\n🔗 \`${state.targetLink}\`\n` +
        `💎 ${state.reward} BNB × ${slots}\n` +
        `🏷 Taxa: ${listingBnb} BNB (~$${LISTING_FEE_USD})\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💳 Total: *${totalCost} BNB* (~$${(totalCost * bnbPrice).toFixed(2)})\n` +
        `💰 Após: *${(saldo - totalCost).toFixed(8)} BNB*`,
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
    const amount     = parseFloat(text);
    const user       = await getUser(msg.from.id);
    const saldo      = user?.balance || 0;
    const minWithdrawBnb = state.minWithdrawBnb || await usdToBnb(MIN_WITHDRAW_USD);
    const bnbPrice   = bnbPriceCached();
    if (isNaN(amount) || amount < minWithdrawBnb) {
      await sendMessage(chatId,
        `❌ Valor inválido.\nMínimo: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD} @ $${bnbPrice}/BNB)`,
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }); return true;
    }
    if (amount > saldo) {
      await sendMessage(chatId,
        `❌ Saldo insuficiente.\nTens *${saldo.toFixed(8)} BNB* (~$${(saldo * bnbPrice).toFixed(2)}).`,
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }); return true;
    }
    setState(msg.from.id, { step: 'withdraw_address', amount });
    await sendMessage(chatId,
      `✅ Valor: *${amount} BNB* (~$${(amount * bnbPrice).toFixed(2)})\n\nEnvia o teu *endereço BSC* (começa com \`0x\`):`,
      { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() });
    return true;
  }

  if (state.step === 'withdraw_address') {
    // Validação endereço BSC: 0x + 40 hex chars
    const valid = /^0x[0-9a-fA-F]{40}$/.test(text);
    if (!valid) {
      await sendMessage(chatId,
        '❌ Endereço inválido.\nFormato BSC: `0x` + 40 caracteres hex\nEx: `0xAbc123…`',
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }); return true;
    }
    setState(msg.from.id, { step: 'withdraw_confirm', amount: state.amount, address: text });
    await sendMessage(chatId,
      `💸 *Confirma o saque*\n\nValor: *${state.amount} BNB*\nRede: *BSC (BEP-20)*\nPara: \`${text}\`\n\n⚠️ Irreversível após confirmação.`,
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
  await editMessage(chatId, msgId, `⏳ A registar pedido de saque…`);
  const user = await getUser(from.id);
  try { await debitUser(user.id, state.amount); }
  catch { clearState(from.id); return editMessage(chatId, msgId, '❌ Saldo insuficiente.'); }
  const ok = await requestBscWithdrawal(user.id, state.address, state.amount);
  if (!ok) {
    await creditUser(user.id, state.amount);
    clearState(from.id);
    return editMessage(chatId, msgId, '❌ Erro ao registar saque. Saldo reembolsado.\nTenta com /sacar.');
  }
  clearState(from.id);
  const bnbPrice = bnbPriceCached();
  await editMessage(chatId, msgId,
    `✅ *Pedido de saque registado!*\n\n` +
    `*${state.amount} BNB* (~$${(state.amount * bnbPrice).toFixed(2)}) para:\n\`${state.address}\`\n\n` +
    `⏳ O saque está em processamento — enviado automaticamente em até *2h*.`,
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
    await sendMessage(msg.chat.id, '❌ Valor inválido. Mínimo $0.1 USD:',
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'dep_cancel' }]] } });
    return true;
  }
  clearState(msg.from.id);
  // Usa fluxo automático BSC (valor em USD)
  await startBscDepositFlow(msg.chat.id, msg.from, amount);
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
        t(DEFAULT_LANG, 'deposit_confirmed', { amount: tx.amount, saldo: '?' }), { parse_mode: 'Markdown' });
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




// ═══════════════════════════════════════════════════════════════════════
// PROMO SWEETCOIN — validação automática 1h
// ═══════════════════════════════════════════════════════════════════════

// Map: telegramId → { userId, chatId, acceptedAt, msgId }
const pendingPromo = new Map();

function schedulePromoValidation(telegramId, userId, chatId) {
  // Evitar duplicados
  if (pendingPromo.has(telegramId)) return;

  const acceptedAt = Date.now();
  pendingPromo.set(telegramId, { userId, chatId, acceptedAt });

  console.log(`[promo] agendado para tg=${telegramId} em 1h`);

  setTimeout(async () => {
    if (!pendingPromo.has(telegramId)) return; // cancelado ou já pago
    pendingPromo.delete(telegramId);

    try {
      // Verificar se já foi pago (idempotência)
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .ilike('note', '%promo_sweetcoin%')
        .maybeSingle();

      if (existing) {
        console.log(`[promo] já pago para user=${userId}, ignorado`);
        return;
      }

      const newBalance = await creditUser(userId, PROMO_TASK.reward);
      await logTx(userId, 'receipt', PROMO_TASK.reward, 'Tarefa promo_sweetcoin validada');

      await sendMessage(chatId,
        `✅ *Tarefa validada automaticamente!*\n\n` +
        `"${PROMO_TASK.title}"\n` +
        `💎 *+${PROMO_TASK.reward} TON* creditados!\n` +
        `Novo saldo: *${newBalance.toFixed(4)} TON*`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
      );

      console.log(`[promo] ✅ pago tg=${telegramId} user=${userId} +${PROMO_TASK.reward} TON`);
    } catch (e) {
      console.error('[promo:auto]', e.message);
    }
  }, 60 * 60 * 1000); // 1 hora
}

// ═══════════════════════════════════════════════════════════════════════
// RANKING GLOBAL
// ═══════════════════════════════════════════════════════════════════════

const PREMIO_TOTAL     = 50;
const PREMIO_TOP       = 10;
const PREMIO_MIN_REFS  = 1000;
const PREMIO_POR_USER  = PREMIO_TOTAL / PREMIO_TOP; // 5 TON cada

async function handleRanking(msg) {
  const chatId = msg.chat.id;
  try {
    const { data: top100 } = await supabase
      .from('users')
      .select('username, first_name, referral_count')
      .order('referral_count', { ascending: false })
      .limit(100);

    if (!top100 || !top100.length)
      return sendMessage(chatId, '\u{1F4CA} Ainda nao ha dados de ranking.', { reply_markup: KB.backToMenu() });

    const PRIZE_POOL = 50;
    const MIN_REFS   = 1000;
    const medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];

    const rankLines = top100.map((u, i) => {
      const pos    = i + 1;
      const name   = u.username ? '@' + u.username : (u.first_name || 'anonimo');
      const refs   = u.referral_count || 0;
      const medal  = medals[i] || `${pos}.`;
      const premio = (pos <= 10 && refs >= MIN_REFS) ? ' \u{1F3C6}' : '';
      return `${medal} ${name} \u2014 *${refs}* refs${premio}`;
    });

    const qualificados = top100.filter((u, i) => i < 10 && (u.referral_count || 0) >= MIN_REFS).length;

    const header =
      '\u{1F30D} *Ranking Global TaskMarket*\n\n' +
      `\u{1F3C6} *Premio: ${PRIZE_POOL} TON* divididos pelos top 10\n` +
      `\u{1F4CC} Requisito: *${MIN_REFS}+ referencias*\n` +
      '\u{1F48E} *5 TON por vencedor*\n\n' +
      `\u2705 Qualificados agora: *${qualificados}/${PREMIO_TOP}*\n` +
      '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';

    await sendMessage(chatId, header + rankLines.slice(0, 20).join('\n'), { parse_mode: 'Markdown' });

    if (rankLines.length > 20) {
      await sendMessage(chatId,
        '*#21 \u2014 #50*\n\n' + rankLines.slice(20, 50).join('\n'),
        { parse_mode: 'Markdown' });
    }
    if (rankLines.length > 50) {
      await sendMessage(chatId,
        '*#51 \u2014 #100*\n\n' + rankLines.slice(50).join('\n') + '\n\n_\u{1F3C6} = qualificado para o premio de 5 TON_',
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
    } else {
      await sendMessage(chatId,
        '_\u{1F3C6} = qualificado para o premio de 5 TON_',
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
    }
  } catch (e) {
    console.error('[ranking]', e.message);
    await sendMessage(chatId, '\u274C Erro ao carregar ranking: ' + e.message);
  }
}

async function handlePagarPremio(msg) {
  if (msg.from.id !== ADMIN_ID)
    return sendMessage(msg.chat.id, '⛔ Sem permissão.');

  try {
    const { data: top10 } = await supabase
      .from('users')
      .select('id, telegram_id, username, first_name, referral_count')
      .order('referral_count', { ascending: false })
      .limit(10);

    const qualificados = (top10 || []).filter(u => (u.referral_count || 0) >= PREMIO_MIN_REFS);

    if (!qualificados.length) {
      return sendMessage(msg.chat.id,
        `⚠️ Nenhum utilizador no top 10 tem ${PREMIO_MIN_REFS}+ referências ainda.
Prémio não pago.`,
        { reply_markup: KB.backToMenu() });
    }

    let resultado = `💰 *Pagamento do Prémio*

`;
    let pagos = 0;

    for (const u of qualificados) {
      try {
        await creditUser(u.id, PREMIO_POR_USER);
        await logTx(u.id, 'premio', PREMIO_POR_USER, 'Prémio ranking top 10');
        await sendMessage(u.telegram_id,
          `🏆 *Parabéns!*

Estás no *Top 10* do ranking global!

` +
          `💎 *+${PREMIO_POR_USER} TON* creditados na tua carteira como prémio.

` +
          `Obrigado por cresceres a comunidade TaskMarket! 🚀`,
          { parse_mode: 'Markdown' });
        resultado += `✅ @${u.username || u.first_name} — +${PREMIO_POR_USER} TON (${u.referral_count} refs)
`;
        pagos++;
      } catch (e) {
        resultado += `❌ @${u.username || u.first_name} — erro: ${e.message}
`;
      }
    }

    resultado += `
💳 *Total pago: ${(pagos * PREMIO_POR_USER).toFixed(2)} TON*`;
    await sendMessage(msg.chat.id, resultado, { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });

  } catch (e) {
    console.error('[pagarpremio]', e.message);
    await sendMessage(msg.chat.id, '❌ Erro: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RELATÓRIO — apenas para o admin
// ═══════════════════════════════════════════════════════════════════════

async function handleRelatorio(msg) {
  if (msg.from.id !== ADMIN_ID)
    return sendMessage(msg.chat.id, '⛔ Sem permissão.');
  try {
    const [
      { count: totalUsers },
      { count: totalTasks },
      { count: openTasks },
      { count: inProgressTasks },
      { count: pendingTasks },
      { count: doneTasks },
      { count: disputedTasks },
      { count: cancelledTasks },
      { data: depData },
      { data: withdrawData },
      { data: topUsers },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('transactions').select('amount').eq('type', 'deposit'),
      supabase.from('transactions').select('amount').eq('type', 'withdrawal'),
      supabase.from('users').select('username,first_name,balance,referral_count')
        .order('balance', { ascending: false }).limit(5),
    ]);

    const totalDep  = (depData      || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalWith = (withdrawData || []).reduce((s, t) => s + Math.abs(parseFloat(t.amount || 0)), 0);
    const saldoPlat = totalDep - totalWith;
    const medals    = ['\u{1F947}','\u{1F948}','\u{1F949}','4\uFE0F\u20E3','5\uFE0F\u20E3'];
    const topLines  = (topUsers || []).map((u, i) =>
      `${medals[i]} @${u.username || u.first_name || 'anonimo'} — *${(u.balance||0).toFixed(4)} TON* · ${u.referral_count||0} refs`
    ).join('\n');
    const now = new Date().toLocaleString('pt-PT', { timeZone: 'UTC' });

    await sendMessage(msg.chat.id,
      `\u{1F4CA} *Relatorio TaskMarket*\n_${now} UTC_\n\n` +
      `\u{1F465} *Utilizadores:* ${totalUsers || 0}\n\n` +
      `\u{1F4CB} *Tarefas:* ${totalTasks || 0} total\n` +
      `  \u{1F7E1} Abertas: *${openTasks || 0}*\n` +
      `  \u{1F535} Em progresso: *${inProgressTasks || 0}*\n` +
      `  \u{1F7E0} Aguarda revisao: *${pendingTasks || 0}*\n` +
      `  \u{2705} Concluidas: *${doneTasks || 0}*\n` +
      `  \u{26A0}\uFE0F Disputas: *${disputedTasks || 0}*\n` +
      `  \u{274C} Canceladas: *${cancelledTasks || 0}*\n\n` +
      `\u{1F4B0} *Financeiro:*\n` +
      `  Depositos: *${totalDep.toFixed(4)} TON*\n` +
      `  Saques: *${totalWith.toFixed(4)} TON*\n` +
      `  Saldo plataforma: *${saldoPlat.toFixed(4)} TON*\n\n` +
      `\u{1F3C6} *Top 5 por saldo:*\n${topLines || 'Sem dados'}`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  } catch (e) {
    console.error('[relatorio]', e.message);
    await sendMessage(msg.chat.id, 'Erro ao gerar relatorio: ' + e.message);
  }
}

async function processUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const cmd = (msg.text || '').trim().split(/[\s@]/)[0].toLowerCase();

    if (cmd !== '/start' && cmd !== '/ajuda' && cmd !== '/help') {
      try {
        if (await handleDepositCustomFSM(msg)) return;
        if (await handleWithdrawFSM(msg))      return;
        if (await handleCreateFSM(msg))        return;
      } catch (e) {
        console.error('[FSM error]', e.message);
      }
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
      case '/relatorio':
      case '/stats':    return handleRelatorio(msg);
      case '/admin':     return; // desactivado
      case '/ajuda':
      case '/help':      return handleAjuda(msg.chat.id, msg.from);
      default:
        if (cmd.startsWith('/'))
          await sendMessage(msg.chat.id, t(lang(msg.from), 'unknown_command'),
            { reply_markup: KB.backToMenu(lang(msg.from)) });
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
                t(DEFAULT_LANG, 'deposit_confirmed', { amount: inv.amount, saldo: newBalance.toFixed(4) }),
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
                  t(DEFAULT_LANG, 'deposit_confirmed', { amount: dbInv.amount, saldo: newBalance.toFixed(4) }),
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
  // Actualiza preço BNB a cada 5 minutos
  getBnbPrice().then(p => console.log(`💱 BNB price: $${p}`));
  setInterval(() => getBnbPrice(), BNB_CACHE_TTL_MS);
  // Polling automático BSCScan para depósitos (estratégia Binance)
  startGlobalBscPolling();
  console.log('⏱ Jobs: reminder 24h ✅  sweep FSM ✅  BNB price ✅  BSC poll ✅');

  setupRealtimeSubscriptions();
});

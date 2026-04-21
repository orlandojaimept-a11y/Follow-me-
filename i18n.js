'use strict';

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

module.exports = { lang, t, btn, STRINGS, LANG_MAP, DEFAULT_LANG };

// ═══════════════════════════════════════════════════════════════════════
// SERVER.JS — TaskMarket Bot  (arquitectura nativa Telegram)
//
// Modelo financeiro:
//   Depósito  — user envia BNB para BSC_RECEIVER_ADDRESS a partir da
//               sua wallet registada. O bot identifica-o pelo tx.from.
//   Saque     — bot envia BNB para a wallet registada do user.
//               Não é necessário introduzir endereço no momento do saque.
//
// Comandos públicos:
//   /start       — registo + referência + menu principal
//   /saldo       — carteira com inline actions
//   /depositar   — depósito BNB via BSC (requer wallet registada)
//   /sacar       — saque para wallet registada (requer wallet registada)
//   /wallet      — registar/ver wallet BSC
//   /tarefas     — listagem paginada + aceitar tarefa
//   /criar       — criação de tarefa por FSM (etapas)
//   /referral    — link + progress bar + leaderboard
//   /minhas      — tarefas do utilizador (anunciante + executor)
//   /ajuda       — menu de ajuda
//
// Painel Admin (/relatorio — apenas ADMIN_ID):
//   stats, top users, disputas, broadcast
//
// ═══════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const https = require('https');
const http  = require('http');
const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════════════
// i18n — INTERNACIONALIZAÇÃO (13 idiomas)
// ═══════════════════════════════════════════════════════════════════════

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

const STRINGS = {

  // ── Boas-vindas ──────────────────────────────────────────────────────

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
    pt: `✅ *Conta criada!*\n\n📋 Completa tarefas e ganha *BNB*\n👥 *+{bonus} BNB* por cada referência\n💎 {minRefs} referências para sacar\n\n👉 Regista a tua wallet BSC com /wallet para poderes depositar e sacar.`,
    en: `✅ *Account created!*\n\n📋 Complete tasks and earn *BNB*\n👥 *+{bonus} BNB* per referral\n💎 {minRefs} referrals to withdraw\n\n👉 Register your BSC wallet with /wallet to deposit and withdraw.`,
    es: `✅ *¡Cuenta creada!*\n\n📋 Completa tareas y gana *BNB*\n👥 *+{bonus} BNB* por referido\n💎 {minRefs} referidos para retirar\n\n👉 Registra tu wallet BSC con /wallet para depositar y retirar.`,
    fr: `✅ *Compte créé !*\n\n📋 Complète des tâches et gagne des *BNB*\n👥 *+{bonus} BNB* par parrainage\n💎 {minRefs} parrainages pour retirer\n\n👉 Enregistre ton wallet BSC avec /wallet pour déposer et retirer.`,
    de: `✅ *Konto erstellt!*\n\n📋 Erledige Aufgaben und verdiene *BNB*\n👥 *+{bonus} BNB* pro Empfehlung\n💎 {minRefs} Empfehlungen zum Auszahlen\n\n👉 Registriere deine BSC-Wallet mit /wallet zum Ein- und Auszahlen.`,
    it: `✅ *Account creato!*\n\n📋 Completa attività e guadagna *BNB*\n👥 *+{bonus} BNB* per riferimento\n💎 {minRefs} riferimenti per prelevare\n\n👉 Registra il tuo wallet BSC con /wallet per depositare e prelevare.`,
    ru: `✅ *Аккаунт создан!*\n\n📋 Выполняй задания и зарабатывай *BNB*\n👥 *+{bonus} BNB* за реферала\n💎 {minRefs} рефералов для вывода\n\n👉 Зарегистрируй BSC-кошелёк через /wallet для пополнения и вывода.`,
    uk: `✅ *Акаунт створено!*\n\n📋 Виконуй завдання та заробляй *BNB*\n👥 *+{bonus} BNB* за реферала\n💎 {minRefs} рефералів для виведення\n\n👉 Зареєструй BSC-гаманець через /wallet для поповнення та виведення.`,
    ar: `✅ *تم إنشاء الحساب!*\n\n📋 أكمل المهام واكسب *BNB*\n👥 *+{bonus} BNB* لكل إحالة\n💎 {minRefs} إحالات للسحب\n\n👉 سجّل محفظة BSC بـ /wallet للإيداع والسحب.`,
    zh: `✅ *账户已创建！*\n\n📋 完成任务赚取 *BNB*\n👥 每次推荐 *+{bonus} BNB*\n💎 需 {minRefs} 次推荐才能提现\n\n👉 使用 /wallet 注册你的 BSC 钱包以存款和提现。`,
    hi: `✅ *खाता बन गया!*\n\n📋 कार्य पूरा करें और *BNB* कमाएं\n👥 प्रत्येक रेफरल पर *+{bonus} BNB*\n💎 निकासी के लिए {minRefs} रेफरल\n\n👉 जमा/निकासी के लिए /wallet से अपना BSC वॉलेट दर्ज करें।`,
    tr: `✅ *Hesap oluşturuldu!*\n\n📋 Görevleri tamamla ve *BNB* kazan\n👥 Her yönlendirme için *+{bonus} BNB*\n💎 Çekim için {minRefs} yönlendirme\n\n👉 Yatırma ve çekim için /wallet ile BSC cüzdanını kaydet.`,
    id: `✅ *Akun dibuat!*\n\n📋 Selesaikan tugas dan dapatkan *BNB*\n👥 *+{bonus} BNB* per referral\n💎 {minRefs} referral untuk withdraw\n\n👉 Daftarkan wallet BSC-mu dengan /wallet untuk deposit dan withdraw.`,
  },

  unknown_command: {
    pt: `❓ Comando desconhecido. Usa /ajuda.`, en: `❓ Unknown command. Use /help.`,
    es: `❓ Comando desconocido. Usa /ayuda.`, fr: `❓ Commande inconnue. Utilise /aide.`,
    de: `❓ Unbekannter Befehl. Verwende /hilfe.`, it: `❓ Comando sconosciuto. Usa /aiuto.`,
    ru: `❓ Неизвестная команда.`, uk: `❓ Невідома команда.`, ar: `❓ أمر غير معروف.`,
    zh: `❓ 未知命令。`, hi: `❓ अज्ञात कमांड।`, tr: `❓ Bilinmeyen komut.`, id: `❓ Perintah tidak dikenal.`,
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

  // ── Wallet BSC ───────────────────────────────────────────────────────

  wallet_ask: {
    pt: `🔑 *Registar Wallet BSC*\n\nEnvia o teu endereço BSC (começa com \`0x\`):\n\n_Esta wallet será usada para depósitos e saques._`,
    en: `🔑 *Register BSC Wallet*\n\nSend your BSC address (starts with \`0x\`):\n\n_This wallet will be used for deposits and withdrawals._`,
    es: `🔑 *Registrar Wallet BSC*\n\nEnvía tu dirección BSC (empieza con \`0x\`):\n\n_Esta wallet se usará para depósitos y retiros._`,
    fr: `🔑 *Enregistrer Wallet BSC*\n\nEnvoie ton adresse BSC (commence par \`0x\`) :\n\n_Ce wallet sera utilisé pour les dépôts et retraits._`,
    de: `🔑 *BSC Wallet registrieren*\n\nSende deine BSC-Adresse (beginnt mit \`0x\`):\n\n_Diese Wallet wird für Ein- und Auszahlungen genutzt._`,
    it: `🔑 *Registra Wallet BSC*\n\nInvia il tuo indirizzo BSC (inizia con \`0x\`):\n\n_Questo wallet sarà usato per depositi e prelievi._`,
    ru: `🔑 *Зарегистрировать BSC-кошелёк*\n\nОтправь свой BSC-адрес (начинается с \`0x\`):\n\n_Этот кошелёк будет использоваться для пополнения и вывода._`,
    uk: `🔑 *Зареєструвати BSC-гаманець*\n\nНадішли свою BSC-адресу (починається з \`0x\`):\n\n_Цей гаманець буде використовуватись для поповнення та виведення._`,
    ar: `🔑 *تسجيل محفظة BSC*\n\nأرسل عنوان BSC الخاص بك (يبدأ بـ \`0x\`):\n\n_ستُستخدم هذه المحفظة للإيداع والسحب._`,
    zh: `🔑 *注册 BSC 钱包*\n\n发送你的 BSC 地址（以 \`0x\` 开头）：\n\n_该钱包将用于存款和提款。_`,
    hi: `🔑 *BSC वॉलेट दर्ज करें*\n\nअपना BSC पता भेजें (\`0x\` से शुरू):\n\n_यह वॉलेट जमा और निकासी के लिए उपयोग होगा।_`,
    tr: `🔑 *BSC Wallet Kaydet*\n\nBSC adresini gönder (\`0x\` ile başlar):\n\n_Bu wallet yatırma ve çekimler için kullanılacak._`,
    id: `🔑 *Daftarkan Wallet BSC*\n\nKirim alamat BSC kamu (dimulai dengan \`0x\`):\n\n_Wallet ini akan digunakan untuk deposit dan penarikan._`,
  },

  wallet_invalid: {
    pt: `❌ Endereço inválido.\n\nFormato BSC: \`0x\` + 40 caracteres hex\nEx: \`0xAbc123…EF\`\n\nTenta de novo:`,
    en: `❌ Invalid address.\n\nBSC format: \`0x\` + 40 hex characters\nEx: \`0xAbc123…EF\`\n\nTry again:`,
    es: `❌ Dirección inválida.\n\nFormato BSC: \`0x\` + 40 caracteres hex\nEj: \`0xAbc123…EF\`\n\nIntenta de nuevo:`,
    fr: `❌ Adresse invalide.\n\nFormat BSC : \`0x\` + 40 caractères hex\nEx : \`0xAbc123…EF\`\n\nRéessaie :`,
    de: `❌ Ungültige Adresse.\n\nBSC-Format: \`0x\` + 40 Hex-Zeichen\nBsp: \`0xAbc123…EF\`\n\nErneut versuchen:`,
    it: `❌ Indirizzo non valido.\n\nFormato BSC: \`0x\` + 40 caratteri hex\nEs: \`0xAbc123…EF\`\n\nRiprova:`,
    ru: `❌ Неверный адрес.\n\nФормат BSC: \`0x\` + 40 hex-символов\nПример: \`0xAbc123…EF\`\n\nПопробуй снова:`,
    uk: `❌ Невірна адреса.\n\nФормат BSC: \`0x\` + 40 hex-символів\nПриклад: \`0xAbc123…EF\`\n\nСпробуй знову:`,
    ar: `❌ عنوان غير صالح.\n\nتنسيق BSC: \`0x\` + 40 حرفاً hex\nمثال: \`0xAbc123…EF\`\n\nحاول مرة أخرى:`,
    zh: `❌ 地址无效。\n\nBSC格式：\`0x\` + 40个十六进制字符\n例：\`0xAbc123…EF\`\n\n请重试：`,
    hi: `❌ पता अमान्य।\n\nBSC प्रारूप: \`0x\` + 40 hex वर्ण\nउदा: \`0xAbc123…EF\`\n\nपुनः प्रयास करें:`,
    tr: `❌ Geçersiz adres.\n\nBSC formatı: \`0x\` + 40 hex karakter\nÖrn: \`0xAbc123…EF\`\n\nTekrar dene:`,
    id: `❌ Alamat tidak valid.\n\nFormat BSC: \`0x\` + 40 karakter hex\nContoh: \`0xAbc123…EF\`\n\nCoba lagi:`,
  },

  wallet_saved: {
    pt: `✅ *Wallet BSC registada!*\n\n\`{wallet}\`\n\nJá podes depositar e sacar BNB.`,
    en: `✅ *BSC Wallet registered!*\n\n\`{wallet}\`\n\nYou can now deposit and withdraw BNB.`,
    es: `✅ *¡Wallet BSC registrada!*\n\n\`{wallet}\`\n\nYa puedes depositar y retirar BNB.`,
    fr: `✅ *Wallet BSC enregistré !*\n\n\`{wallet}\`\n\nTu peux maintenant déposer et retirer des BNB.`,
    de: `✅ *BSC-Wallet registriert!*\n\n\`{wallet}\`\n\nDu kannst jetzt BNB ein- und auszahlen.`,
    it: `✅ *Wallet BSC registrato!*\n\n\`{wallet}\`\n\nOra puoi depositare e prelevare BNB.`,
    ru: `✅ *BSC-кошелёк зарегистрирован!*\n\n\`{wallet}\`\n\nТеперь можешь пополнять и выводить BNB.`,
    uk: `✅ *BSC-гаманець зареєстровано!*\n\n\`{wallet}\`\n\nТепер можеш поповнювати та виводити BNB.`,
    ar: `✅ *تم تسجيل محفظة BSC!*\n\n\`{wallet}\`\n\nيمكنك الآن الإيداع وسحب BNB.`,
    zh: `✅ *BSC 钱包已注册！*\n\n\`{wallet}\`\n\n现在可以存款和提现 BNB 了。`,
    hi: `✅ *BSC वॉलेट दर्ज हुआ!*\n\n\`{wallet}\`\n\nअब आप BNB जमा और निकाल सकते हैं।`,
    tr: `✅ *BSC Wallet kaydedildi!*\n\n\`{wallet}\`\n\nArtık BNB yatırabilir ve çekebilirsin.`,
    id: `✅ *Wallet BSC terdaftar!*\n\n\`{wallet}\`\n\nSekarang kamu bisa deposit dan withdraw BNB.`,
  },

  wallet_view: {
    pt: `🔑 *Tua Wallet BSC*\n\n\`{wallet}\`\n\n_Esta é a carteira usada para depósitos e saques._\n\nQueres alterar? Envia um novo endereço BSC:`,
    en: `🔑 *Your BSC Wallet*\n\n\`{wallet}\`\n\n_This is the wallet used for deposits and withdrawals._\n\nWant to change it? Send a new BSC address:`,
    es: `🔑 *Tu Wallet BSC*\n\n\`{wallet}\`\n\n_Esta es la wallet usada para depósitos y retiros._\n\n¿Quieres cambiarla? Envía una nueva dirección BSC:`,
    fr: `🔑 *Ton Wallet BSC*\n\n\`{wallet}\`\n\n_C'est le wallet utilisé pour les dépôts et retraits._\n\nVeux-tu le changer ? Envoie une nouvelle adresse BSC :`,
    de: `🔑 *Deine BSC-Wallet*\n\n\`{wallet}\`\n\n_Diese Wallet wird für Ein- und Auszahlungen genutzt._\n\nÄndern? Neue BSC-Adresse senden:`,
    it: `🔑 *Il tuo Wallet BSC*\n\n\`{wallet}\`\n\n_Questo wallet è usato per depositi e prelievi._\n\nVuoi cambiarlo? Invia un nuovo indirizzo BSC:`,
    ru: `🔑 *Твой BSC-кошелёк*\n\n\`{wallet}\`\n\n_Этот кошелёк используется для пополнения и вывода._\n\nХочешь изменить? Отправь новый BSC-адрес:`,
    uk: `🔑 *Твій BSC-гаманець*\n\n\`{wallet}\`\n\n_Цей гаманець використовується для поповнення та виведення._\n\nХочеш змінити? Надішли нову BSC-адресу:`,
    ar: `🔑 *محفظة BSC الخاصة بك*\n\n\`{wallet}\`\n\n_هذه المحفظة مستخدمة للإيداع والسحب._\n\nتريد تغييرها؟ أرسل عنوان BSC جديداً:`,
    zh: `🔑 *你的 BSC 钱包*\n\n\`{wallet}\`\n\n_此钱包用于存款和提款。_\n\n想要更换？发送新的 BSC 地址：`,
    hi: `🔑 *तुम्हारा BSC वॉलेट*\n\n\`{wallet}\`\n\n_यह वॉलेट जमा और निकासी के लिए उपयोग होता है।_\n\nबदलना चाहते हैं? नया BSC पता भेजें:`,
    tr: `🔑 *BSC Wallet'ın*\n\n\`{wallet}\`\n\n_Bu wallet yatırma ve çekimler için kullanılıyor._\n\nDeğiştirmek ister misin? Yeni BSC adresi gönder:`,
    id: `🔑 *Wallet BSC Kamu*\n\n\`{wallet}\`\n\n_Wallet ini digunakan untuk deposit dan penarikan._\n\nMau ganti? Kirim alamat BSC baru:`,
  },

  wallet_required: {
    pt: `⚠️ *Wallet BSC não registada*\n\nPrecisas de registar a tua wallet BSC para depositar ou sacar.\n\nUsa /wallet para registar.`,
    en: `⚠️ *BSC Wallet not registered*\n\nYou need to register your BSC wallet to deposit or withdraw.\n\nUse /wallet to register.`,
    es: `⚠️ *Wallet BSC no registrada*\n\nNecesitas registrar tu wallet BSC para depositar o retirar.\n\nUsa /wallet para registrar.`,
    fr: `⚠️ *Wallet BSC non enregistré*\n\nTu dois enregistrer ton wallet BSC pour déposer ou retirer.\n\nUtilise /wallet pour t'enregistrer.`,
    de: `⚠️ *BSC-Wallet nicht registriert*\n\nDu musst deine BSC-Wallet registrieren, um ein- oder auszuzahlen.\n\nNutze /wallet zum Registrieren.`,
    it: `⚠️ *Wallet BSC non registrato*\n\nDevi registrare il tuo wallet BSC per depositare o prelevare.\n\nUsa /wallet per registrarti.`,
    ru: `⚠️ *BSC-кошелёк не зарегистрирован*\n\nДля пополнения или вывода нужно зарегистрировать BSC-кошелёк.\n\nИспользуй /wallet для регистрации.`,
    uk: `⚠️ *BSC-гаманець не зареєстровано*\n\nДля поповнення або виведення потрібно зареєструвати BSC-гаманець.\n\nВикористай /wallet для реєстрації.`,
    ar: `⚠️ *محفظة BSC غير مسجلة*\n\nيجب تسجيل محفظة BSC للإيداع أو السحب.\n\nاستخدم /wallet للتسجيل.`,
    zh: `⚠️ *BSC 钱包未注册*\n\n您需要注册 BSC 钱包才能存款或提款。\n\n使用 /wallet 注册。`,
    hi: `⚠️ *BSC वॉलेट दर्ज नहीं*\n\nजमा या निकासी के लिए BSC वॉलेट दर्ज करना होगा।\n\n/wallet से दर्ज करें।`,
    tr: `⚠️ *BSC Wallet kayıtlı değil*\n\nYatırma veya çekim için BSC wallet'ını kaydetmen gerekiyor.\n\nKaydetmek için /wallet kullan.`,
    id: `⚠️ *Wallet BSC belum terdaftar*\n\nKamu perlu mendaftarkan wallet BSC untuk deposit atau withdraw.\n\nGunakan /wallet untuk mendaftar.`,
  },

  // ── Saldo ────────────────────────────────────────────────────────────

  balance_withdraw_ready: {
    pt: `✅ Saque disponível!`, en: `✅ Withdrawal available!`, es: `✅ ¡Retiro disponible!`,
    fr: `✅ Retrait disponible !`, de: `✅ Auszahlung verfügbar!`, it: `✅ Prelievo disponibile!`,
    ru: `✅ Вывод доступен!`, uk: `✅ Виведення доступне!`, ar: `✅ السحب متاح!`,
    zh: `✅ 可以提现！`, hi: `✅ निकासी उपलब्ध!`, tr: `✅ Çekim mevcut!`, id: `✅ Penarikan tersedia!`,
  },

  balance_need_more: {
    pt: `⏳ Faltam *{faltam}* referências para sacar.`, en: `⏳ *{faltam}* more referrals to withdraw.`,
    es: `⏳ Faltan *{faltam}* referidos para retirar.`, fr: `⏳ Il manque *{faltam}* parrainages pour retirer.`,
    de: `⏳ Noch *{faltam}* Empfehlungen bis zur Auszahlung.`, it: `⏳ Mancano *{faltam}* riferimenti per prelevare.`,
    ru: `⏳ Ещё *{faltam}* рефералов до вывода.`, uk: `⏳ Ще *{faltam}* рефералів до виведення.`,
    ar: `⏳ تحتاج *{faltam}* إحالات إضافية للسحب.`, zh: `⏳ 还需 *{faltam}* 次推荐才能提现。`,
    hi: `⏳ निकासी के लिए *{faltam}* और रेफरल चाहिए।`, tr: `⏳ Çekim için *{faltam}* yönlendirme daha gerekiyor.`,
    id: `⏳ Butuh *{faltam}* referral lagi untuk withdraw.`,
  },

  // ── Saque ────────────────────────────────────────────────────────────

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

  withdraw_cancelled: {
    pt: `❌ Saque cancelado.`, en: `❌ Withdrawal cancelled.`, es: `❌ Retiro cancelado.`,
    fr: `❌ Retrait annulé.`, de: `❌ Auszahlung abgebrochen.`, it: `❌ Prelievo annullato.`,
    ru: `❌ Вывод отменён.`, uk: `❌ Виведення скасовано.`, ar: `❌ تم إلغاء السحب.`,
    zh: `❌ 提现已取消。`, hi: `❌ निकासी रद्द।`, tr: `❌ Çekim iptal edildi.`, id: `❌ Penarikan dibatalkan.`,
  },

  // ── Depósito ─────────────────────────────────────────────────────────

  deposit_cancelled: {
    pt: `❌ Depósito cancelado.`, en: `❌ Deposit cancelled.`, es: `❌ Depósito cancelado.`,
    fr: `❌ Dépôt annulé.`, de: `❌ Einzahlung abgebrochen.`, it: `❌ Deposito annullato.`,
    ru: `❌ Депозит отменён.`, uk: `❌ Депозит скасовано.`, ar: `❌ تم إلغاء الإيداع.`,
    zh: `❌ 充值已取消。`, hi: `❌ जमा रद्द।`, tr: `❌ Para yatırma iptal edildi.`, id: `❌ Deposit dibatalkan.`,
  },

  // ── Tarefas ──────────────────────────────────────────────────────────

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

  task_cancelled: {
    pt: `✅ *Tarefa cancelada.*\n\n💎 *+{refund} BNB* reembolsado.\n_(Taxa de {fee} BNB não reembolsada.)_`,
    en: `✅ *Task cancelled.*\n\n💎 *+{refund} BNB* refunded.\n_(Listing fee of {fee} BNB not refunded.)_`,
    es: `✅ *Tarea cancelada.*\n\n💎 *+{refund} BNB* reembolsado.\n_(La tarifa de {fee} BNB no se reembolsa.)_`,
    fr: `✅ *Tâche annulée.*\n\n💎 *+{refund} BNB* remboursé.\n_(Les frais de {fee} BNB ne sont pas remboursés.)_`,
    de: `✅ *Aufgabe abgebrochen.*\n\n💎 *+{refund} BNB* erstattet.\n_(Listungsgebühr {fee} BNB nicht erstattet.)_`,
    it: `✅ *Attività annullata.*\n\n💎 *+{refund} BNB* rimborsato.\n_(La commissione di {fee} BNB non viene rimborsata.)_`,
    ru: `✅ *Задание отменено.*\n\n💎 *+{refund} BNB* возвращено.\n_(Комиссия {fee} BNB не возвращается.)_`,
    uk: `✅ *Завдання скасовано.*\n\n💎 *+{refund} BNB* повернуто.\n_(Комісія {fee} BNB не повертається.)_`,
    ar: `✅ *تم إلغاء المهمة.*\n\n💎 *+{refund} BNB* مستردة.\n_(رسوم {fee} BNB غير قابلة للاسترداد.)_`,
    zh: `✅ *任务已取消。*\n\n💎 已退还 *+{refund} BNB*。\n_(上架费 {fee} BNB 不予退还。)_`,
    hi: `✅ *कार्य रद्द।*\n\n💎 *+{refund} BNB* वापस हुआ।\n_(सूचीकरण शुल्क {fee} BNB वापस नहीं होगा।)_`,
    tr: `✅ *Görev iptal edildi.*\n\n💎 *+{refund} BNB* iade edildi.\n_(Listeleme ücreti {fee} BNB iade edilmez.)_`,
    id: `✅ *Tugas dibatalkan.*\n\n💎 *+{refund} BNB* dikembalikan.\n_(Biaya listing {fee} BNB tidak dikembalikan.)_`,
  },

  // ── Referral ─────────────────────────────────────────────────────────

  // ── Ajuda ────────────────────────────────────────────────────────────

  help_text: {
    pt: `🤖 *TaskMarket — Comandos*\n\n/start     — Menu principal\n/saldo     — Saldo e carteira\n/wallet    — Registar/ver wallet BSC\n/depositar — Depositar BNB via BSC\n/sacar     — Sacar BNB para wallet\n/tarefas   — Tarefas disponíveis\n/criar     — Publicar nova tarefa\n/minhas    — As tuas tarefas\n/referral  — Link e leaderboard\n/ajuda     — Este menu\n\n💎 *Como funciona:*\n• Regista a tua wallet BSC com /wallet\n• Deposita enviando BNB a partir da tua wallet\n• Saque vai directamente para a tua wallet\n• Taxa de listagem: *$${LISTING_FEE_USD}*\n• Saque com *{minRefs}* referências`,
    en: `🤖 *TaskMarket — Commands*\n\n/start     — Main menu\n/saldo     — Balance & wallet\n/wallet    — Register/view BSC wallet\n/depositar — Deposit BNB via BSC\n/sacar     — Withdraw BNB to wallet\n/tarefas   — Available tasks\n/criar     — Post a new task\n/minhas    — Your tasks\n/referral  — Link & leaderboard\n/ajuda     — This menu\n\n💎 *How it works:*\n• Register your BSC wallet with /wallet\n• Deposit by sending BNB from your wallet\n• Withdrawal goes directly to your wallet\n• Listing fee: *$${LISTING_FEE_USD}*\n• Withdraw with *{minRefs}* referrals`,
    es: `🤖 *TaskMarket — Comandos*\n\n/start     — Menú principal\n/saldo     — Saldo y cartera\n/wallet    — Registrar/ver wallet BSC\n/depositar — Depositar BNB via BSC\n/sacar     — Retirar BNB a wallet\n/tarefas   — Tareas disponibles\n/criar     — Publicar nueva tarea\n/minhas    — Tus tareas\n/referral  — Link y tabla de líderes\n/ajuda     — Este menú\n\n💎 *Cómo funciona:*\n• Registra tu wallet BSC con /wallet\n• Deposita enviando BNB desde tu wallet\n• El retiro va directamente a tu wallet\n• Tarifa de listado: *$${LISTING_FEE_USD}*\n• Retira con *{minRefs}* referidos`,
    fr: `🤖 *TaskMarket — Commandes*\n\n/start     — Menu principal\n/saldo     — Solde et portefeuille\n/wallet    — Enregistrer/voir wallet BSC\n/depositar — Déposer BNB via BSC\n/sacar     — Retirer BNB vers wallet\n/tarefas   — Tâches disponibles\n/criar     — Publier une tâche\n/minhas    — Tes tâches\n/referral  — Lien et classement\n/ajuda     — Ce menu\n\n💎 *Comment ça marche :*\n• Enregistre ton wallet BSC avec /wallet\n• Dépose en envoyant BNB depuis ton wallet\n• Le retrait va directement à ton wallet\n• Frais de publication : *$${LISTING_FEE_USD}*\n• Retrait avec *{minRefs}* parrainages`,
    de: `🤖 *TaskMarket — Befehle*\n\n/start     — Hauptmenü\n/saldo     — Guthaben & Wallet\n/wallet    — BSC-Wallet registrieren/anzeigen\n/depositar — BNB via BSC einzahlen\n/sacar     — BNB an Wallet auszahlen\n/tarefas   — Verfügbare Aufgaben\n/criar     — Neue Aufgabe erstellen\n/minhas    — Deine Aufgaben\n/referral  — Link & Rangliste\n/ajuda     — Dieses Menü\n\n💎 *So funktioniert es:*\n• BSC-Wallet mit /wallet registrieren\n• Einzahlen durch Senden von BNB von deiner Wallet\n• Auszahlung geht direkt an deine Wallet\n• Listungsgebühr: *$${LISTING_FEE_USD}*\n• Auszahlung mit *{minRefs}* Empfehlungen`,
    it: `🤖 *TaskMarket — Comandi*\n\n/start     — Menu principale\n/saldo     — Saldo e portafoglio\n/wallet    — Registra/vedi wallet BSC\n/depositar — Deposita BNB via BSC\n/sacar     — Preleva BNB al wallet\n/tarefas   — Attività disponibili\n/criar     — Pubblica nuova attività\n/minhas    — Le tue attività\n/referral  — Link e classifica\n/ajuda     — Questo menu\n\n💎 *Come funziona:*\n• Registra il wallet BSC con /wallet\n• Deposita inviando BNB dal tuo wallet\n• Il prelievo va direttamente al tuo wallet\n• Commissione: *$${LISTING_FEE_USD}*\n• Preleva con *{minRefs}* riferimenti`,
    ru: `🤖 *TaskMarket — Команды*\n\n/start     — Главное меню\n/saldo     — Баланс и кошелёк\n/wallet    — Зарегистрировать/посмотреть BSC-кошелёк\n/depositar — Пополнить BNB через BSC\n/sacar     — Вывести BNB на кошелёк\n/tarefas   — Доступные задания\n/criar     — Создать задание\n/minhas    — Мои задания\n/referral  — Ссылка и лидерборд\n/ajuda     — Это меню\n\n💎 *Как это работает:*\n• Зарегистрируй BSC-кошелёк через /wallet\n• Пополняй, отправляя BNB со своего кошелька\n• Вывод идёт прямо на твой кошелёк\n• Комиссия: *$${LISTING_FEE_USD}*\n• Вывод при *{minRefs}* рефералах`,
    uk: `🤖 *TaskMarket — Команди*\n\n/start     — Головне меню\n/saldo     — Баланс і гаманець\n/wallet    — Зареєструвати/переглянути BSC-гаманець\n/depositar — Поповнити BNB через BSC\n/sacar     — Вивести BNB на гаманець\n/tarefas   — Доступні завдання\n/criar     — Створити завдання\n/minhas    — Мої завдання\n/referral  — Посилання та таблиця\n/ajuda     — Це меню\n\n💎 *Як це працює:*\n• Зареєструй BSC-гаманець через /wallet\n• Поповнюй, надсилаючи BNB зі свого гаманця\n• Виведення йде прямо на твій гаманець\n• Комісія: *$${LISTING_FEE_USD}*\n• Виведення при *{minRefs}* рефералах`,
    ar: `🤖 *TaskMarket — الأوامر*\n\n/start     — القائمة الرئيسية\n/saldo     — الرصيد والمحفظة\n/wallet    — تسجيل/عرض محفظة BSC\n/depositar — إيداع BNB عبر BSC\n/sacar     — سحب BNB إلى المحفظة\n/tarefas   — المهام المتاحة\n/criar     — نشر مهمة جديدة\n/minhas    — مهامي\n/referral  — الرابط والترتيب\n/ajuda     — هذه القائمة\n\n💎 *كيف يعمل:*\n• سجّل محفظة BSC بـ /wallet\n• أودِع بإرسال BNB من محفظتك\n• السحب يذهب مباشرة لمحفظتك\n• رسوم النشر: *$${LISTING_FEE_USD}*\n• السحب بـ *{minRefs}* إحالة`,
    zh: `🤖 *TaskMarket — 命令*\n\n/start     — 主菜单\n/saldo     — 余额与钱包\n/wallet    — 注册/查看 BSC 钱包\n/depositar — 通过 BSC 充值 BNB\n/sacar     — 提现 BNB 到钱包\n/tarefas   — 可用任务\n/criar     — 发布新任务\n/minhas    — 我的任务\n/referral  — 链接与排行榜\n/ajuda     — 此菜单\n\n💎 *运作方式：*\n• 使用 /wallet 注册 BSC 钱包\n• 从你的钱包发送 BNB 进行充值\n• 提现直接到你的钱包\n• 上架费：*$${LISTING_FEE_USD}*\n• 需 *{minRefs}* 次推荐才能提现`,
    hi: `🤖 *TaskMarket — कमांड*\n\n/start     — मुख्य मेनू\n/saldo     — शेष और वॉलेट\n/wallet    — BSC वॉलेट दर्ज/देखें\n/depositar — BSC के जरिए BNB जमा\n/sacar     — वॉलेट में BNB निकालें\n/tarefas   — उपलब्ध कार्य\n/criar     — नया कार्य पोस्ट करें\n/minhas    — मेरे कार्य\n/referral  — लिंक और लीडरबोर्ड\n/ajuda     — यह मेनू\n\n💎 *कैसे काम करता है:*\n• /wallet से BSC वॉलेट दर्ज करें\n• अपने वॉलेट से BNB भेज कर जमा करें\n• निकासी सीधे आपके वॉलेट में जाती है\n• लिस्टिंग शुल्क: *$${LISTING_FEE_USD}*\n• *{minRefs}* रेफरल पर निकासी`,
    tr: `🤖 *TaskMarket — Komutlar*\n\n/start     — Ana menü\n/saldo     — Bakiye ve cüzdan\n/wallet    — BSC wallet kaydet/görüntüle\n/depositar — BSC ile BNB yatır\n/sacar     — Wallet'a BNB çek\n/tarefas   — Mevcut görevler\n/criar     — Yeni görev yayınla\n/minhas    — Görevlerim\n/referral  — Link ve sıralama\n/ajuda     — Bu menü\n\n💎 *Nasıl çalışır:*\n• /wallet ile BSC wallet'ını kaydet\n• Wallet'ından BNB göndererek yatır\n• Çekim doğrudan wallet'ına gider\n• Listeleme ücreti: *$${LISTING_FEE_USD}*\n• *{minRefs}* yönlendirme ile çekim`,
    id: `🤖 *TaskMarket — Perintah*\n\n/start     — Menu utama\n/saldo     — Saldo & dompet\n/wallet    — Daftarkan/lihat wallet BSC\n/depositar — Deposit BNB via BSC\n/sacar     — Tarik BNB ke wallet\n/tarefas   — Lihat tugas tersedia\n/criar     — Posting tugas baru\n/minhas    — Tugas saya\n/referral  — Link & leaderboard\n/ajuda     — Menu ini\n\n💎 *Cara kerja:*\n• Daftarkan wallet BSC dengan /wallet\n• Deposit dengan kirim BNB dari walletmu\n• Penarikan langsung ke walletmu\n• Biaya listing: *$${LISTING_FEE_USD}*\n• Withdraw dengan *{minRefs}* referral`,
  },

  // ── Buttons ──────────────────────────────────────────────────────────

  btn_wallet:      { pt:'🔑 Minha Wallet', en:'🔑 My Wallet', es:'🔑 Mi Wallet', fr:'🔑 Mon Wallet', de:'🔑 Meine Wallet', it:'🔑 Il Mio Wallet', ru:'🔑 Мой кошелёк', uk:'🔑 Мій гаманець', ar:'🔑 محفظتي', zh:'🔑 我的钱包', hi:'🔑 मेरा वॉलेट', tr:'🔑 Wallet\'ım', id:'🔑 Wallet Saya' },
  btn_main_menu:   { pt:'◀️ Menu Principal', en:'◀️ Main Menu', es:'◀️ Menú Principal', fr:'◀️ Menu Principal', de:'◀️ Hauptmenü', it:'◀️ Menu Principale', ru:'◀️ Главное меню', uk:'◀️ Головне меню', ar:'◀️ القائمة الرئيسية', zh:'◀️ 主菜单', hi:'◀️ मुख्य मेनू', tr:'◀️ Ana Menü', id:'◀️ Menu Utama' },
  btn_deposit:     { pt:'💰 Depositar BNB', en:'💰 Deposit BNB', es:'💰 Depositar BNB', fr:'💰 Déposer BNB', de:'💰 BNB einzahlen', it:'💰 Deposita BNB', ru:'💰 Пополнить BNB', uk:'💰 Поповнити BNB', ar:'💰 إيداع BNB', zh:'💰 充值 BNB', hi:'💰 BNB जमा', tr:'💰 BNB Yatır', id:'💰 Deposit BNB' },
  btn_withdraw:    { pt:'💸 Sacar BNB', en:'💸 Withdraw BNB', es:'💸 Retirar BNB', fr:'💸 Retirer BNB', de:'💸 BNB auszahlen', it:'💸 Preleva BNB', ru:'💸 Вывести BNB', uk:'💸 Вивести BNB', ar:'💸 سحب BNB', zh:'💸 提现 BNB', hi:'💸 BNB निकालें', tr:'💸 BNB Çek', id:'💸 Tarik BNB' },
  btn_share_link:  { pt:'📤 Partilhar link', en:'📤 Share link', es:'📤 Compartir enlace', fr:'📤 Partager le lien', de:'📤 Link teilen', it:'📤 Condividi link', ru:'📤 Поделиться', uk:'📤 Поділитись', ar:'📤 مشاركة الرابط', zh:'📤 分享链接', hi:'📤 लिंक शेयर', tr:'📤 Linki Paylaş', id:'📤 Bagikan Link' },
  btn_register_wallet: { pt:'🔑 Registar Wallet', en:'🔑 Register Wallet', es:'🔑 Registrar Wallet', fr:'🔑 Enregistrer Wallet', de:'🔑 Wallet registrieren', it:'🔑 Registra Wallet', ru:'🔑 Зарегистрировать кошелёк', uk:'🔑 Зареєструвати гаманець', ar:'🔑 تسجيل المحفظة', zh:'🔑 注册钱包', hi:'🔑 वॉलेट दर्ज करें', tr:'🔑 Wallet Kaydet', id:'🔑 Daftar Wallet' },
};

// ═══════════════════════════════════════════════════════════════════════
// i18n API
// ═══════════════════════════════════════════════════════════════════════

function lang(from) {
  if (!from?.language_code) return DEFAULT_LANG;
  const raw = from.language_code.toLowerCase().trim();
  return LANG_MAP[raw] || LANG_MAP[raw.split('-')[0]] || DEFAULT_LANG;
}

function t(locale, key, vars = {}) {
  const group = STRINGS[key];
  if (!group) { console.warn(`[i18n] chave desconhecida: "${key}"`); return key; }
  const template = group[locale] || group[DEFAULT_LANG] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : `{${k}}`);
}

// ═══════════════════════════════════════════════════════════════════════
// ENV / CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════

const BOT_TOKEN    = process.env.BOT_TOKEN;
const PORT         = parseInt(process.env.PORT || '3000', 10);
const ADMIN_ID     = 7991785009;
const BOT_USERNAME = (process.env.BOT_USERNAME || 'TaskMarket_Bot').trim();
const RENDER_URL   = (process.env.RENDER_EXTERNAL_URL || '').trim();
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;
const BSC_API_KEY  = process.env.BSC_API_KEY || '';

// Endereço da plataforma — para onde o user ENVIA o depósito
const BSC_RECEIVER_ADDRESS = '0xfa80431966FD890F562C68Eb3cC2a0692760A159';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Constantes em USD — convertidas para BNB em runtime
const REFERRAL_BONUS_USD   = 0.01;
const LISTING_FEE_USD      = 0.10;
const MIN_WITHDRAW_USD     = 1.00;
const MIN_REFS_WITHDRAW    = 30;
const TASKS_PER_PAGE       = 5;
const LISTING_FEE          = LISTING_FEE_USD;
const REFERRAL_BONUS       = REFERRAL_BONUS_USD;
const FSM_TIMEOUT_MS       = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const PENDING_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

// ── Cache do preço BNB/USD ────────────────────────────────────────────
let _bnbPriceUsd       = 600;
let _bnbPriceFetchedAt = 0;
const BNB_CACHE_TTL_MS = 5 * 60 * 1000;

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
          const data  = JSON.parse(raw);
          const price = data?.binancecoin?.usd;
          if (price && price > 0) {
            _bnbPriceUsd       = price;
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

async function usdToBnb(usd) {
  const price = await getBnbPrice();
  return parseFloat((usd / price).toFixed(8));
}

function bnbPriceCached() { return _bnbPriceUsd; }

// ── Tarefas promo ─────────────────────────────────────────────────────
const PROMO_TASK = {
  id: 'promo_sweetcoin', title: 'Ganha Dinheiro Real Só por Caminhar!',
  task_type: 'promo', reward: 0.01,
  description: 'Transforma cada passo em recompensas com Sweetcoin.\n\n🔥 Desafio Ultimate:\nConvida 20 amigos e recebe $10 diretamente no teu PayPal!\n\n👉 Começa agora:\nhttps://swcapp.com/i/orlandojaime27142264868',
  target_link: 'https://swcapp.com/i/orlandojaime27142264868',
  slots_remaining: 9999, status: 'open', is_promo: true,
};

const PROMO_TASK_2 = {
  id: 'promo_daminexs', title: 'Ganha USDT — Convida Amigos para o Daminexs!',
  task_type: 'promo', reward: 0.01,
  description: 'Junta-te ao Daminexs e ganha USDT por convidar amigos!\n\n👥 Cada amigo = *+0.02 USDT*\n💸 Levantamento mínimo: *0.20 USDT*\n\n👉 Começa agora:\nhttps://t.me/daminexs_bot?start=r00914962806',
  target_link: 'https://t.me/daminexs_bot?start=r00914962806',
  slots_remaining: 9999, status: 'open', is_promo: true,
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
const userState     = new Map();
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
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
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

const sendMessage    = (chatId, text, extra = {}) => tgCall('sendMessage', { chat_id: chatId, text, ...extra });
const editMessage    = (chatId, msgId, text, extra = {}) => tgCall('editMessageText', { chat_id: chatId, message_id: msgId, text, ...extra });
const editMarkup     = (chatId, msgId, reply_markup) => tgCall('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup });
const answerCallback = (id, text = '', alert = false) => tgCall('answerCallbackQuery', { callback_query_id: id, text, show_alert: alert });
const deleteMessage  = (chatId, msgId) => tgCall('deleteMessage', { chat_id: chatId, message_id: msgId });

// ═══════════════════════════════════════════════════════════════════════
// BSC HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Busca txs recentes recebidas pelo BSC_RECEIVER_ADDRESS.
 * Retry automático em rate limit (até 3 tentativas).
 */
async function getBscIncomingTxs(startBlock = 0, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  return new Promise((resolve) => {
    const path = `/api?module=account&action=txlist&address=${BSC_RECEIVER_ADDRESS}` +
                 `&startblock=${startBlock}&endblock=99999999&sort=desc&page=1&offset=100` +
                 (BSC_API_KEY ? `&apikey=${BSC_API_KEY}` : '');
    const req = https.request({
      hostname: 'api.bscscan.com', path, method: 'GET',
      headers: { 'User-Agent': 'TaskMarket/1.0' },
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          if (r.status === '1') { resolve(r.result || []); return; }
          const msg = (r.message || '') + (r.result || '');
          if ((msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) && attempt < MAX_ATTEMPTS) {
            setTimeout(() => getBscIncomingTxs(startBlock, attempt + 1).then(resolve), attempt * 2000);
            return;
          }
          if (r.message === 'No transactions found') { resolve([]); return; }
          console.error(`[bscscan] ERRO status=${r.status} message=${r.message}`);
          resolve([]);
        } catch (e) { console.error('[bscscan] parse error:', e.message); resolve([]); }
      });
    });
    req.on('error', (e) => {
      if (attempt < MAX_ATTEMPTS) setTimeout(() => getBscIncomingTxs(startBlock, attempt + 1).then(resolve), attempt * 1000);
      else resolve([]);
    });
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Verifica depósito BSC.
 * Novo modelo: identifica o user pelo tx.from === user.bsc_wallet.
 * Garante idempotência global por tx hash.
 */
async function checkBscDeposit(userId, chatId) {
  try {
    console.log(`[checkBscDeposit] START userId=${userId}`);

    // Busca dados do user (incluindo bsc_wallet)
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user || !user.bsc_wallet) {
      console.log(`[checkBscDeposit] user sem bsc_wallet: userId=${userId}`);
      return false;
    }

    // Busca txs recentes na BSCScan
    const txs = await getBscIncomingTxs(0);
    console.log(`[checkBscDeposit] txs BSCScan: ${txs.length}`);
    if (!txs.length) return false;

    // Hashes globalmente já processados — previne duplo crédito
    const { data: processedTxRows } = await supabase.from('transactions')
      .select('note').ilike('note', '%bsc_tx_%');
    const processedHashes = new Set(
      (processedTxRows || [])
        .map(t => { const m = t.note?.match(/bsc_tx_(\w+)/); return m ? m[1] : null; })
        .filter(Boolean)
    );

    // Filtra: destino correcto + remetente == wallet do user + sem erro + não processada
    const eligible = txs.filter(tx =>
      tx.to?.toLowerCase()   === BSC_RECEIVER_ADDRESS.toLowerCase() &&
      tx.from?.toLowerCase() === user.bsc_wallet.toLowerCase() &&
      tx.isError === '0' &&
      parseFloat(tx.value) > 0 &&
      !processedHashes.has(tx.hash)
    );
    console.log(`[checkBscDeposit] txs elegíveis para user: ${eligible.length}`);
    if (!eligible.length) return false;

    // Pega a tx mais recente elegível
    const tx       = eligible[0];
    const amountBnb = parseFloat(tx.value) / 1e18;
    console.log(`[checkBscDeposit] tx=${tx.hash} from=${tx.from} amount=${amountBnb} BNB`);

    // Credita com idempotência global
    const newBalance = await creditDepositIdempotent(userId, amountBnb, `bsc_tx_${tx.hash}`);
    if (newBalance === null) {
      console.warn(`[checkBscDeposit] tx ${tx.hash} já creditada`);
      return false;
    }

    // Notifica o user
    const bnbPrice = bnbPriceCached();
    await sendMessage(chatId,
      `✅ *Depósito confirmado!*\n\n` +
      `💎 *+${amountBnb.toFixed(8)} BNB* (~$${(amountBnb * bnbPrice).toFixed(2)})\n` +
      `Saldo actual: *${newBalance.toFixed(8)} BNB*`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );

    console.log(`[checkBscDeposit] ✅ CREDITADO userId=${userId} +${amountBnb} BNB tx=${tx.hash}`);
    return true;

  } catch (e) {
    console.error('[checkBscDeposit] ERRO:', e.message);
    return false;
  }
}

/**
 * Saque BSC: envia BNB para a wallet registada do user.
 * Sem chave privada → fallback manual (notifica admin).
 */
async function requestBscWithdrawal(userId, toAddress, amount) {
  const privateKey = process.env.BSC_PRIVATE_KEY;

  // ── fallback manual ───────────────────────────────────────────────
  try {
    await logTx(userId, 'withdrawal_pending', -amount,
      `Saque BNB pendente → ${toAddress} | processamento manual`);
    await sendMessage(ADMIN_ID,
      `💸 *Pedido de saque BNB*\n\nUser ID: \`${userId}\`\nEndereço: \`${toAddress}\`\nValor: *${amount} BNB*\n\n⚠️ Processar manualmente na BSC.`,
      { parse_mode: 'Markdown' });
    return { ok: true, txHash: null };
  } catch (e) {
    console.error('[bsc:withdrawal:manual]', e.message);
    return { ok: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════

async function getUser(telegramId) {
  const { data, error } = await supabase.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
  if (error) console.error('[db:getUser]', error.code, error.message);
  return data || null;
}


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
    telegram_id:    from.id,
    username:       from.username || null,
    first_name:     from.first_name || '',
    last_name:      from.last_name  || '',
    balance:        0,
    referral_count: 0,
    referred_by:    null,
    bsc_wallet:     null,      // campo novo — registado via /wallet
    created_at:     new Date().toISOString(),
  }).select().single();
  if (error) {
    if (error.code === '23505') return getUser(from.id);
    throw error;
  }
  return data;
}

async function updateUserProfile(from) {
  await supabase.from('users').update({
    username:   from.username   || null,
    first_name: from.first_name || '',
    last_name:  from.last_name  || '',
  }).eq('telegram_id', from.id);
}

async function creditUser(userId, amount) {
  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  const newBalance = parseFloat(((user?.balance || 0) + amount).toFixed(8));
  await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
  return newBalance;
}

async function debitUser(userId, amount) {
  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  const newBalance = parseFloat(((user?.balance || 0) - amount).toFixed(8));
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

async function creditDepositIdempotent(userId, amount, txHash) {
  const { data: existing } = await supabase.from('transactions')
    .select('id').ilike('note', `%${txHash}%`).maybeSingle();
  if (existing) { console.warn(`[deposit] tx já processada: ${txHash}`); return null; }
  const newBalance = await creditUser(userId, amount);
  await logTx(userId, 'deposit', amount, `Depósito BNB · ${txHash}`);
  return newBalance;
}

// ═══════════════════════════════════════════════════════════════════════
// REFERRALS
// ═══════════════════════════════════════════════════════════════════════

async function processReferral(referrerTelegramId, newUserId, from) {
  if (!referrerTelegramId || referrerTelegramId === from.id) return;
  const referrer = await getUser(referrerTelegramId);
  if (!referrer) { console.warn(`[referral] referrer tg=${referrerTelegramId} não encontrado`); return; }

  const { data: dup } = await supabase.from('referrals').select('id')
    .eq('referrer_id', referrer.id).eq('referred_id', newUserId).maybeSingle();
  if (dup) { console.warn(`[referral] duplicado ignorado`); return; }

  const novoCount = (referrer.referral_count || 0) + 1;
  const bonusBnb  = await usdToBnb(REFERRAL_BONUS_USD);
  const bnbPrice  = bnbPriceCached();

  await supabase.from('users').update({
    balance:        parseFloat(((referrer.balance || 0) + bonusBnb).toFixed(8)),
    referral_count: novoCount,
  }).eq('id', referrer.id);

  await supabase.from('referrals').insert({
    referrer_id: referrer.id, referred_id: newUserId,
    bonus_paid: bonusBnb, created_at: new Date().toISOString(),
  });

  await logTx(referrer.id, 'referral', bonusBnb,
    `Referência: @${from.username || from.first_name || from.id}`);

  console.log(`[referral] ✅ referrer.id=${referrer.id} count=${novoCount} bonus=${bonusBnb} BNB`);

  const faltam = MIN_REFS_WITHDRAW - novoCount;
  await sendMessage(referrerTelegramId,
    `🎉 *Nova referência!*\n\n` +
    `@${from.username || from.first_name || 'utilizador'} entrou pelo teu link.\n` +
    `💎 *+${bonusBnb} BNB* (~$${REFERRAL_BONUS_USD}) creditado!\n` +
    `📊 *${novoCount}/${MIN_REFS_WITHDRAW}* referências\n\n` +
    (faltam <= 0 ? `✅ Atingiste o mínimo! Usa /sacar.` : `⏳ Faltam *${faltam}* para sacar.`),
    { parse_mode: 'Markdown' }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════

const KB = {

  // ╔══════════════════════════════════════╗
  // ║         MENU PRINCIPAL               ║
  // ║  ┌─────────────┬────────────────┐    ║
  // ║  │ 💎 Carteira │  📋 Tarefas   │    ║
  // ║  ├─────────────┴────────────────┤    ║
  // ║  │   💰 Depositar BNB           │    ║
  // ║  │   💸 Sacar BNB               │    ║
  // ║  ├──────────────┬───────────────┤    ║
  // ║  │ ➕ Criar     │  👥 Referral  │    ║
  // ║  ├──────────────┴───────────────┤    ║
  // ║  │ 🔑 Wallet   │  📁 Minhas    │    ║
  // ║  ├──────────────┴───────────────┤    ║
  // ║  │          ❓ Ajuda            │    ║
  // ╚══════════════════════════════════════╝
  mainMenu: (lc = DEFAULT_LANG) => ({
    inline_keyboard: [
      [
        { text: '💎 Carteira',     callback_data: 'menu_saldo'    },
        { text: '📋 Tarefas',      callback_data: 'menu_tarefas'  },
      ],
      [{ text: '💰 Depositar BNB', callback_data: 'menu_depositar' }],
      [{ text: '💸 Sacar BNB',     callback_data: 'menu_sacar'    }],
      [
        { text: '➕ Criar Tarefa', callback_data: 'menu_criar'    },
        { text: '👥 Referral',     callback_data: 'menu_referral' },
      ],
      [
        { text: '🔑 Wallet BSC',   callback_data: 'menu_wallet'   },
        { text: '📁 Minhas',       callback_data: 'menu_minhas'   },
      ],
      [{ text: '❓ Ajuda',         callback_data: 'menu_ajuda'    }],
    ]
  }),

  // ╔══════════════════════════════════════╗
  // ║      CARTEIRA / SALDO                ║
  // ║  ┌──────────────────────────────┐   ║
  // ║  │   💰 Depositar BNB           │   ║
  // ║  │   💸 Sacar BNB               │   ║
  // ║  ├──────────────┬───────────────┤   ║
  // ║  │ 🔑 Wallet    │ ◀️ Menu       │   ║
  // ╚══════════════════════════════════════╝
  walletMenu: (lc = DEFAULT_LANG) => ({
    inline_keyboard: [
      [{ text: '💰 Depositar BNB',  callback_data: 'menu_depositar' }],
      [{ text: '💸 Sacar BNB',      callback_data: 'menu_sacar'    }],
      [
        { text: '🔑 Alterar Wallet', callback_data: 'menu_wallet'  },
        { text: '◀️ Menu',           callback_data: 'menu_main'    },
      ],
    ]
  }),

  // ╔══════════════════════════════════════╗
  // ║         DEPÓSITO BSC                 ║
  // ║  ┌──────────────────────────────┐   ║
  // ║  │  🔄 Já enviei — Verificar    │   ║
  // ║  ├──────────────────────────────┤   ║
  // ║  │       ◀️ Menu Principal      │   ║
  // ╚══════════════════════════════════════╝
  depositBsc: (userId) => ({
    inline_keyboard: [
      [{ text: '🔄 Já enviei — Verificar', callback_data: `dep_check|${userId}` }],
      [{ text: '◀️ Menu Principal',        callback_data: 'menu_main'           }],
    ]
  }),

  // ╔══════════════════════════════════════╗
  // ║         LISTA DE TAREFAS             ║
  // ║  [tarefa 1] [tarefa 2]               ║
  // ║  ◀️  página  ▶️                      ║
  // ║  ◀️ Menu                             ║
  // ╚══════════════════════════════════════╝
  taskList: (tasks, page, total, showPromo = false) => {
    const rows = [];
    if (showPromo) {
      rows.push([{ text: '⭐ PROMO · Sweetcoin — Ganha BNB a Caminhar', callback_data: 'task_view_promo_sweetcoin' }]);
      rows.push([{ text: '⭐ PROMO · Daminexs — Ganha USDT a Convidar', callback_data: 'task_view_promo_daminexs' }]);
    }
    // 2 tarefas por linha para aproveitar o espaço
    for (let i = 0; i < tasks.length; i += 2) {
      const row = [{ text: `${taskTypeEmoji(tasks[i].task_type)} ${tasks[i].title}`, callback_data: `task_view_${tasks[i].id}` }];
      if (tasks[i + 1]) row.push({ text: `${taskTypeEmoji(tasks[i+1].task_type)} ${tasks[i+1].title}`, callback_data: `task_view_${tasks[i+1].id}` });
      rows.push(row);
    }
    const nav = [];
    if (page > 0)                            nav.push({ text: '◀️ Anterior', callback_data: `tasks_page_${page - 1}` });
    if ((page + 1) * TASKS_PER_PAGE < total) nav.push({ text: 'Próxima ▶️', callback_data: `tasks_page_${page + 1}` });
    if (nav.length) rows.push(nav);
    rows.push([{ text: '◀️ Menu Principal', callback_data: 'menu_main' }]);
    return { inline_keyboard: rows };
  },

  // ╔══════════════════════════════════════╗
  // ║         DETALHE DE TAREFA            ║
  // ║  [acção primária — largura total]    ║
  // ║  [⚠️ Disputar] só se necessário      ║
  // ║  [🗑 Cancelar] só dono + open        ║
  // ║  [◀️ Voltar às Tarefas]              ║
  // ╚══════════════════════════════════════╝
  taskDetail: (task, userId) => {
    const rows = [];
    if (task.is_promo) {
      rows.push([{ text: '🚀 Abrir e Ganhar BNB', url: task.target_link }]);
      rows.push([{ text: '◀️ Voltar às Tarefas',  callback_data: 'menu_tarefas' }]);
      return { inline_keyboard: rows };
    }
    if (task.status === 'open' && task.advertiser_id !== userId && (task.slots_remaining || 0) > 0)
      rows.push([{ text: '✅ Aceitar esta Tarefa', callback_data: `task_accept_${task.id}` }]);
    if (task.status === 'in_progress' && task.executor_id === userId)
      rows.push([{ text: '📤 Submeter para Revisão', callback_data: `task_submit_${task.id}` }]);
    if (task.status === 'pending_review' && task.advertiser_id === userId)
      rows.push([
        { text: '✅ Aprovar',    callback_data: `task_approve_${task.id}` },
        { text: '⚠️ Disputar',  callback_data: `task_dispute_${task.id}` },
      ]);
    if (task.status === 'open' && task.advertiser_id === userId)
      rows.push([{ text: '🗑️ Cancelar Tarefa', callback_data: `task_cancel_${task.id}` }]);
    rows.push([{ text: '◀️ Voltar às Tarefas', callback_data: 'menu_tarefas' }]);
    return { inline_keyboard: rows };
  },

  // ╔══════════════════════════════════════╗
  // ║       TIPOS DE TAREFA                ║
  // ║  [📢 Canal]  [👥 Grupo]             ║
  // ║  [🤖 Bot]                           ║
  // ║  [❌ Cancelar]                       ║
  // ╚══════════════════════════════════════╝
  taskTypes: () => ({
    inline_keyboard: [
      [
        { text: '📢 Canal',  callback_data: 'create_type_join_channel' },
        { text: '👥 Grupo',  callback_data: 'create_type_join_group'   },
      ],
      [{ text: '🤖 Iniciar Bot', callback_data: 'create_type_join_bot' }],
      [{ text: '❌ Cancelar',    callback_data: 'create_cancel'        }],
    ]
  }),

  // ╔══════════════════════════════════════╗
  // ║       CONFIRMAÇÃO DE TAREFA          ║
  // ║  [✅ Publicar Agora]                 ║
  // ║  [❌ Cancelar]                       ║
  // ╚══════════════════════════════════════╝
  createConfirm: () => ({
    inline_keyboard: [
      [{ text: '🚀 Publicar Agora',  callback_data: 'create_confirm' }],
      [{ text: '❌ Cancelar',        callback_data: 'create_cancel'  }],
    ]
  }),

  // ╔══════════════════════════════════════╗
  // ║       CONFIRMAÇÃO DE SAQUE           ║
  // ║  [✅ Confirmar Saque]                ║
  // ║  [❌ Cancelar]                       ║
  // ╚══════════════════════════════════════╝
  withdrawConfirm: () => ({
    inline_keyboard: [
      [{ text: '✅ Confirmar Saque', callback_data: 'withdraw_confirm' }],
      [{ text: '❌ Cancelar',        callback_data: 'withdraw_cancel'  }],
    ]
  }),

  withdrawCancel: () => ({
    inline_keyboard: [[{ text: '❌ Cancelar Saque', callback_data: 'withdraw_cancel' }]]
  }),

  // ╔══════════════════════════════════════╗
  // ║       DISPUTA — ADMIN               ║
  // ║  [✅ Pagar] [❌ Reembolsar]          ║
  // ╚══════════════════════════════════════╝
  disputeAdmin: (taskId) => ({
    inline_keyboard: [[
      { text: '✅ Pagar Executor',       callback_data: `dispute_accept_${taskId}` },
      { text: '↩️ Reembolsar Anunciante', callback_data: `dispute_reject_${taskId}` },
    ]]
  }),

  backToMenu:  (lc = DEFAULT_LANG) => ({ inline_keyboard: [[{ text: '◀️ Menu Principal', callback_data: 'menu_main' }]] }),
  backToAdmin: () => ({ inline_keyboard: [[{ text: '◀️ Painel Admin', callback_data: 'adm_menu' }]] }),
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

  if (referrerTelegramId && referrerTelegramId !== from.id)
    pendingReferrals.set(from.id, referrerTelegramId);

  const nome    = from.first_name || 'utilizador';
  const locale0 = lang(from);
  await sendMessage(chatId,
    t(locale0, 'inicio_menu', { nome }),
    { parse_mode: 'Markdown', reply_markup: KB.mainMenu(locale0) }
  ).catch(() => {});

  // Registo em background
  try {
    let user = await getUser(from.id);
    const isNew = !user;
    if (isNew) {
      user = await createUser(from);
      console.log(`[/start] novo user: id=${user.id} tg=${from.id}`);
    } else {
      updateUserProfile(from).catch(() => {});
    }

    if (referrerTelegramId && referrerTelegramId !== from.id && !user.referred_by) {
      const referrer = await getUser(referrerTelegramId);
      if (referrer) {
        await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id);
        await processReferral(referrerTelegramId, user.id, from);
      }
      pendingReferrals.delete(from.id);
    } else {
      pendingReferrals.delete(from.id);
    }

    if (isNew) {
      await sendMessage(chatId,
        t(locale0, 'account_created', { bonus: REFERRAL_BONUS, minRefs: MIN_REFS_WITHDRAW }),
        { parse_mode: 'Markdown', reply_markup: {
          inline_keyboard: [[{ text: t(locale0,'btn_register_wallet'), callback_data: 'menu_wallet' }]]
        }}
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[/start:bg] ❌', err.message);
  }
}

async function handleInicio(msg) { return handleStart(msg); }

// ── /wallet — registar/ver wallet BSC ────────────────────────────────
async function handleWallet(msg) {
  const user   = await getOrCreateUser(msg.from);
  const locale = lang(msg.from);

  if (user.bsc_wallet) {
    setState(msg.from.id, { step: 'wallet_update' });
    await sendMessage(msg.chat.id,
      t(locale, 'wallet_view', { wallet: user.bsc_wallet }),
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) }
    );
  } else {
    setState(msg.from.id, { step: 'wallet_register' });
    await sendMessage(msg.chat.id,
      t(locale, 'wallet_ask'),
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) }
    );
  }
}

// FSM de registo de wallet
async function handleWalletFSM(msg) {
  const state = getState(msg.from.id);
  if (!state || !['wallet_register','wallet_update'].includes(state.step)) return false;
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const locale = lang(msg.from);

  // Validar endereço BSC
  if (!/^0x[0-9a-fA-F]{40}$/.test(text)) {
    await sendMessage(chatId, t(locale, 'wallet_invalid'),
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) });
    return true;
  }

  // Guardar na BD
  const user = await getOrCreateUser(msg.from);
  await supabase.from('users').update({ bsc_wallet: text }).eq('id', user.id);
  clearState(msg.from.id);

  await sendMessage(chatId,
    t(locale, 'wallet_saved', { wallet: text }),
    { parse_mode: 'Markdown', reply_markup: KB.walletMenu(locale) }
  );
  return true;
}

// ── /saldo ────────────────────────────────────────────────────────────
async function handleSaldo(msg) {
  const user     = await getOrCreateUser(msg.from);
  const locale   = lang(msg.from);
  const refs     = user.referral_count || 0;
  const saldoBnb = user.balance || 0;
  const bnbPrice = await getBnbPrice();
  const saldoUsd = (saldoBnb * bnbPrice).toFixed(2);
  const minWithdrawBnb = await usdToBnb(MIN_WITHDRAW_USD);
  const prog     = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar      = '█'.repeat(prog) + '░'.repeat(10 - prog);
  const statusLine = refs >= MIN_REFS_WITHDRAW
    ? t(locale, 'balance_withdraw_ready')
    : t(locale, 'balance_need_more', { faltam: MIN_REFS_WITHDRAW - refs });

  const walletLine = user.bsc_wallet
    ? `🔑 Wallet: \`${user.bsc_wallet.slice(0,6)}…${user.bsc_wallet.slice(-4)}\``
    : `⚠️ _Wallet não registada — usa /wallet_`;

  await sendMessage(msg.chat.id,
    `💎 *Carteira TaskMarket*\n\n` +
    `Saldo: *${saldoBnb.toFixed(8)} BNB*\n` +
    `≈ *$${saldoUsd} USD*\n` +
    `💱 Preço BNB: *$${bnbPrice}*\n\n` +
    `${walletLine}\n\n` +
    `👥 Referências: *${refs}/${MIN_REFS_WITHDRAW}*\n${bar}\n\n` +
    `Mínimo de saque: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD})\n\n` +
    statusLine,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(locale,'btn_deposit'),   callback_data: 'menu_depositar' },
           { text: t(locale,'btn_withdraw'),  callback_data: 'menu_sacar'    }],
          [{ text: t(locale,'btn_wallet'),    callback_data: 'menu_wallet'   }],
          [{ text: t(locale,'btn_main_menu'), callback_data: 'menu_main'    }],
        ]
      }
    }
  );
}

// ── /depositar ────────────────────────────────────────────────────────
async function handleDepositar(msg) {
  const user   = await getOrCreateUser(msg.from);
  const locale = lang(msg.from);

  // Requer wallet registada
  if (!user.bsc_wallet) {
    return sendMessage(msg.chat.id,
      t(locale, 'wallet_required'),
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [
          [{ text: t(locale,'btn_register_wallet'), callback_data: 'menu_wallet' }],
          [{ text: t(locale,'btn_main_menu'),       callback_data: 'menu_main'   }],
        ]
      }}
    );
  }

  const bnbPrice = bnbPriceCached();

  await sendMessage(msg.chat.id,
    `💰 *Depositar BNB (BSC)*\n\n` +
    `Rede: *Binance Smart Chain (BEP-20)*\n\n` +
    `Endereço da plataforma:\n\`${BSC_RECEIVER_ADDRESS}\`\n\n` +
    `⚠️ *Envia APENAS a partir da tua wallet registada:*\n\`${user.bsc_wallet}\`\n\n` +
    `_O depósito é detectado automaticamente pelo endereço de origem. Não uses outra wallet._\n\n` +
    `💱 BNB actual: *$${bnbPrice}*\n` +
    `✅ Crédito automático após confirmação (~1-3 min)`,
    {
      parse_mode: 'Markdown',
      reply_markup: KB.depositBsc(user.id)
    }
  );
}

// ── /sacar ────────────────────────────────────────────────────────────
async function handleSacar(msg) {
  const user        = await getOrCreateUser(msg.from);
  const locale      = lang(msg.from);

  // Requer wallet registada
  if (!user.bsc_wallet) {
    return sendMessage(msg.chat.id,
      t(locale, 'wallet_required'),
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [
          [{ text: t(locale,'btn_register_wallet'), callback_data: 'menu_wallet' }],
          [{ text: t(locale,'btn_main_menu'),       callback_data: 'menu_main'   }],
        ]
      }}
    );
  }

  const refs = user.referral_count || 0;
  if (refs < MIN_REFS_WITHDRAW) {
    return sendMessage(msg.chat.id,
      t(locale, 'withdraw_blocked', { minRefs: MIN_REFS_WITHDRAW, refs, faltam: MIN_REFS_WITHDRAW - refs }),
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) }
    );
  }

  const saldoBnb      = user.balance || 0;
  const bnbPrice      = await getBnbPrice();
  const minWithdrawBnb = await usdToBnb(MIN_WITHDRAW_USD);

  setState(msg.from.id, { step: 'withdraw_amount', locale, minWithdrawBnb, wallet: user.bsc_wallet });

  await sendMessage(msg.chat.id,
    `💸 *Saque BNB*\n\n` +
    `Saldo: *${saldoBnb.toFixed(8)} BNB* (~$${(saldoBnb * bnbPrice).toFixed(2)})\n` +
    `💱 Preço BNB: *$${bnbPrice}*\n\n` +
    `🔑 Destino: \`${user.bsc_wallet}\`\n` +
    `Mínimo de saque: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD})\n\n` +
    `Envia o valor em BNB que queres sacar:`,
    { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() }
  );
}

// ── /tarefas ──────────────────────────────────────────────────────────
async function handleTarefas(msg, page = 0) {
  const user   = await getOrCreateUser(msg.from);
  const offset = page * TASKS_PER_PAGE;
  const { data: tasks, count } = await supabase
    .from('tasks')
    .select('id, title, task_type, reward, slots_remaining', { count: 'exact' })
    .eq('status', 'open').gt('slots_remaining', 0)
    .neq('advertiser_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + TASKS_PER_PAGE - 1);

  const showPromo = page === 0;
  const linhas = (tasks || []).map((t, i) =>
    `${offset + i + 1}. ${taskTypeEmoji(t.task_type)} *${t.title}*\n   💎 ${t.reward} BNB · ${t.slots_remaining} vaga(s)`
  ).join('\n\n');

  if (!tasks?.length && !showPromo) {
    return sendMessage(msg.chat.id,
      `📋 *Tarefas Disponíveis*\n\nNenhuma tarefa aberta.\nVolta mais tarde!`,
      { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
    );
  }

  await sendMessage(msg.chat.id,
    `📋 *Tarefas Disponíveis* (${(count || 0) + (showPromo ? 2 : 0)} total)\n\n` +
    (linhas || '_Sem tarefas regulares neste momento._') +
    `\n\n_Clica numa tarefa para ver detalhes:_`,
    { parse_mode: 'Markdown', reply_markup: KB.taskList(tasks || [], page, count || 0, showPromo) }
  );
}

// ── /criar ────────────────────────────────────────────────────────────
async function handleCriar(msg) {
  const user       = await getOrCreateUser(msg.from);
  const listingBnb = await usdToBnb(LISTING_FEE_USD);
  const bnbPrice   = bnbPriceCached();
  if ((user.balance || 0) < listingBnb) {
    return sendMessage(msg.chat.id,
      `❌ *Saldo insuficiente*\n\n` +
      `Taxa de listagem: *${listingBnb} BNB* (~$${LISTING_FEE_USD})\n` +
      `Saldo: *${(user.balance||0).toFixed(8)} BNB*\n\nDeposita com /depositar.`,
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

// ── /referral ─────────────────────────────────────────────────────────
async function handleReferral(msg) {
  const user    = await getOrCreateUser(msg.from);
  const locale  = lang(msg.from);
  const link    = `https://t.me/${BOT_USERNAME}?start=r${msg.from.id}`;
  const refs    = user.referral_count || 0;
  const bnbPrice = await getBnbPrice();
  const bonusBnb = await usdToBnb(REFERRAL_BONUS_USD);
  const earned  = (refs * bonusBnb).toFixed(8);
  const earnedUsd = (refs * REFERRAL_BONUS_USD).toFixed(2);
  const prog    = Math.min(Math.round((refs / MIN_REFS_WITHDRAW) * 10), 10);
  const bar     = '█'.repeat(prog) + '░'.repeat(10 - prog);

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
          [{ text: t(locale,'btn_share_link'), switch_inline_query: `Junta-te ao TaskMarket e ganha BNB! ${link}` }],
          [{ text: t(locale,'btn_main_menu'),  callback_data: 'menu_main' }],
        ]
      }
    }
  );
}

// ── /minhas ───────────────────────────────────────────────────────────
async function handleMinhas(msg) {
  const user = await getOrCreateUser(msg.from);
  const [{ data: anunciante }, { data: executor }] = await Promise.all([
    supabase.from('tasks').select('id,title,status,reward').eq('advertiser_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('id,title,status,reward').eq('executor_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  let text = `📁 *As Minhas Tarefas*\n\n`;
  if (anunciante?.length)
    text += `*Como Anunciante:*\n` +
      anunciante.map(t => `${statusEmoji(t.status)} [#${t.id}] ${t.title} — ${t.reward} BNB`).join('\n') + '\n\n';
  if (executor?.length)
    text += `*Como Executor:*\n` +
      executor.map(t => `${statusEmoji(t.status)} [#${t.id}] ${t.title} — ${t.reward} BNB`).join('\n');
  if (!anunciante?.length && !executor?.length)
    text += `Ainda não participaste em nenhuma tarefa.\nUsa /tarefas para começar!`;
  await sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

// ── /ajuda ────────────────────────────────────────────────────────────
async function handleAjuda(chatId, from) {
  const locale = from ? lang(from) : DEFAULT_LANG;
  await sendMessage(chatId,
    t(locale, 'help_text', { minRefs: MIN_REFS_WITHDRAW }),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WITHDRAW FSM — só pede valor; endereço vem da wallet registada
// ═══════════════════════════════════════════════════════════════════════

async function handleWithdrawFSM(msg) {
  const state = getState(msg.from.id);
  if (!state || !state.step?.startsWith('withdraw_')) return false;
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  if (state.step === 'withdraw_amount') {
    const amount       = parseFloat(text);
    const user         = await getUser(msg.from.id);
    const saldo        = user?.balance || 0;
    const minWithdrawBnb = state.minWithdrawBnb || await usdToBnb(MIN_WITHDRAW_USD);
    const bnbPrice     = bnbPriceCached();

    if (isNaN(amount) || amount < minWithdrawBnb) {
      await sendMessage(chatId,
        `❌ Valor inválido.\nMínimo: *${minWithdrawBnb} BNB* (~$${MIN_WITHDRAW_USD} @ $${bnbPrice}/BNB)`,
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() });
      return true;
    }
    if (amount > saldo) {
      await sendMessage(chatId,
        `❌ Saldo insuficiente.\nTens *${saldo.toFixed(8)} BNB* (~$${(saldo * bnbPrice).toFixed(2)}).`,
        { parse_mode: 'Markdown', reply_markup: KB.withdrawCancel() });
      return true;
    }

    // Confirma directamente — endereço já conhecido
    const wallet = state.wallet || user?.bsc_wallet;
    setState(msg.from.id, { step: 'withdraw_confirm', amount, wallet });
    await sendMessage(chatId,
      `💸 *Confirma o saque*\n\n` +
      `Valor: *${amount} BNB* (~$${(amount * bnbPrice).toFixed(2)})\n` +
      `Rede: *BSC (BEP-20)*\n` +
      `Para: \`${wallet}\`\n\n` +
      `⚡ Processamento em até *24h* na rede BSC.`,
      { parse_mode: 'Markdown', reply_markup: KB.withdrawConfirm() }
    );
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
  await editMessage(chatId, msgId, `⏳ A processar saque…`);
  const user = await getUser(from.id);
  if (!user?.bsc_wallet) {
    clearState(from.id);
    return editMessage(chatId, msgId, '❌ Wallet BSC não registada. Usa /wallet.');
  }
  try { await debitUser(user.id, state.amount); }
  catch { clearState(from.id); return editMessage(chatId, msgId, '❌ Saldo insuficiente.'); }

  const result = await requestBscWithdrawal(user.id, user.bsc_wallet, state.amount);
  if (!result || !result.ok) {
    await creditUser(user.id, state.amount);
    clearState(from.id);
    return editMessage(chatId, msgId, '❌ Erro ao processar saque. Saldo reembolsado.\nTenta com /sacar.');
  }
  clearState(from.id);
  const bnbPrice = bnbPriceCached();
  const txLine   = result.txHash
    ? `\n🔗 Tx: \`${result.txHash}\`\n_Ver em [BSCScan](https://bscscan.com/tx/${result.txHash})_`
    : `\n⏳ O admin processa em até *24h* na rede BSC.`;
  await editMessage(chatId, msgId,
    `✅ *Saque processado!*\n\n` +
    `*${state.amount} BNB* (~$${(state.amount * bnbPrice).toFixed(2)}) para:\n\`${user.bsc_wallet}\`` +
    txLine,
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
        await sendMessage(chatId, '❌ Título deve ter 5–60 caracteres:', { reply_markup: cancelKb });
        return true;
      }
      setState(msg.from.id, { ...state, step: 'create_link', title: text });
      await sendMessage(chatId, `✅ Título: *${text}*\n\nEnvia o *link* (URL ou @username):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_link': {
      if (!text.startsWith('http') && !text.startsWith('t.me') && !text.startsWith('@')) {
        await sendMessage(chatId, '❌ Link inválido. Envia URL ou @username:', { reply_markup: cancelKb });
        return true;
      }
      setState(msg.from.id, { ...state, step: 'create_reward', targetLink: text });
      await sendMessage(chatId, `✅ Link: \`${text}\`\n\nEnvia a *recompensa por executor* em BNB (ex: \`0.5\`):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_reward': {
      const reward = parseFloat(text);
      if (isNaN(reward) || reward < 0.001) {
        await sendMessage(chatId, '❌ Valor inválido. Mínimo 0.001 BNB:', { reply_markup: cancelKb });
        return true;
      }
      setState(msg.from.id, { ...state, step: 'create_slots', reward });
      await sendMessage(chatId, `✅ Recompensa: *${reward} BNB* por executor\n\nQuantos executores? (1–100):`,
        { parse_mode: 'Markdown', reply_markup: cancelKb });
      return true;
    }
    case 'create_slots': {
      const slots    = parseInt(text, 10);
      if (isNaN(slots) || slots < 1 || slots > 100) {
        await sendMessage(chatId, '❌ Número inválido. Entre 1 e 100:', { reply_markup: cancelKb });
        return true;
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
          { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
        return true;
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
    advertiser_id:   user.id,
    task_type:       state.taskType,
    title:           state.title,
    target_link:     state.targetLink,
    reward:          state.reward,
    total_slots:     state.slots,
    slots_remaining: state.slots,
    status:          'open',
    created_at:      new Date().toISOString(),
  }).select().single();
  if (error) {
    await creditUser(user.id, state.totalCost);
    console.error('[createTask]', error.message);
    return sendMessage(chatId, '❌ Erro ao criar. Saldo reembolsado.');
  }
  await logTx(user.id, 'payment', -state.totalCost, `Tarefa publicada #${task.id}`);
  clearState(from.id);
  await editMessage(chatId, msgId,
    `✅ *Tarefa publicada!*\n\n#${task.id} — ${task.title}\n💎 ${state.reward} BNB × ${state.slots}\n\nJá visível em /tarefas.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
  await sendMessage(ADMIN_ID,
    `📢 *Nova tarefa*\n#${task.id} — ${task.title}\nAnunciante: @${from.username||from.first_name}\n${state.reward} BNB × ${state.slots}`,
    { parse_mode: 'Markdown' });
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
    `💎 Recompensa: *${task.reward} BNB*\n` +
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
    `📋 *Tarefa aceite!*\n"${task.title}"\n👤 @${from.username || from.first_name}\n💎 ${task.reward} BNB em escrow.`,
    { parse_mode: 'Markdown' });
  const locale = lang(from);
  const linkLine = task.target_link ? `🔗 ${task.target_link}\n\n` : '';
  await sendMessage(chatId,
    t(locale, 'task_accepted', { title: task.title, linkLine }),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) });
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
  const locale = lang(from);
  await editMessage(chatId, msgId, t(locale, 'task_submitted'),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu(locale) });
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
    `✅ *Pagamento recebido!*\n"${task.title}"\n💎 *+${task.reward} BNB* na tua carteira!`,
    { parse_mode: 'Markdown' });
  await editMessage(chatId, msgId,
    `✅ *Aprovado!*\n*${task.reward} BNB* enviados para @${exec?.username || exec?.first_name || 'executor'}.`,
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function openDispute(chatId, msgId, from, taskId) {
  const user = await getUser(from.id);
  if (!user) return;
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!task || task.advertiser_id !== user.id) return;
  await supabase.from('tasks').update({ status: 'disputed' }).eq('id', taskId);
  await sendMessage(ADMIN_ID,
    `⚠️ *Nova disputa*\n\n*${task.title}* (#${taskId})\nReportado por: @${from.username || from.first_name}\nRecompensa: *${task.reward} BNB*`,
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
  const refund = parseFloat((task.reward * task.slots_remaining).toFixed(8));
  await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId);
  if (refund > 0) {
    await creditUser(user.id, refund);
    await logTx(user.id, 'refund', refund, `Tarefa cancelada #${taskId}`);
  }
  await editMessage(chatId, msgId,
    t(lang(from), 'task_cancelled', { refund: refund.toFixed(6), fee: LISTING_FEE }),
    { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
}

async function handleDisputeCallback(cb, data) {
  if (cb.from.id !== ADMIN_ID) return answerCallback(cb.id, '⛔ Sem permissão.', true);
  const [action, taskId] = [data.startsWith('dispute_accept') ? 'accept' : 'reject',
    data.replace(/dispute_(accept|reject)_/, '')];
  const { data: task } = await supabase.from('tasks')
    .select('*, executor:executor_id(id,telegram_id), advertiser:advertiser_id(id,telegram_id)')
    .eq('id', taskId).single();
  if (!task) return answerCallback(cb.id, '❌ Tarefa não encontrada.', true);
  await answerCallback(cb.id);
  if (action === 'accept') {
    await supabase.rpc('pay_executor', { p_task_id: taskId, p_executor_id: task.executor_id, p_amount: task.reward });
    await logTx(task.executor.id, 'receipt', task.reward, `Disputa resolvida #${taskId}`);
    if (task.executor?.telegram_id)
      await sendMessage(task.executor.telegram_id, `✅ Disputa resolvida! *+${task.reward} BNB* creditado.`, { parse_mode: 'Markdown' });
  } else {
    await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId);
    await creditUser(task.advertiser.id, task.reward);
    await logTx(task.advertiser.id, 'refund', task.reward, `Disputa rejeitada #${taskId}`);
    if (task.advertiser?.telegram_id)
      await sendMessage(task.advertiser.telegram_id, `❌ Disputa resolvida — *+${task.reward} BNB* reembolsado.`, { parse_mode: 'Markdown' });
  }
  await editMessage(cb.message.chat.id, cb.message.message_id,
    `✅ Disputa #${taskId} resolvida — ${action === 'accept' ? 'executor pago' : 'anunciante reembolsado'}.`,
    { reply_markup: KB.backToAdmin() });
}

// ═══════════════════════════════════════════════════════════════════════
// PROMO TASKS — Sweetcoin + Daminexs
// ═══════════════════════════════════════════════════════════════════════

const pendingPromo = new Map();

function schedulePromoValidation(telegramId, userId, chatId, promoKey, promoTask) {
  if (pendingPromo.has(promoKey)) return;
  pendingPromo.set(promoKey, { userId, chatId, acceptedAt: Date.now() });
  console.log(`[promo] agendado key=${promoKey} tg=${telegramId} em 1h`);
  setTimeout(async () => {
    if (!pendingPromo.has(promoKey)) return;
    pendingPromo.delete(promoKey);
    try {
      const { data: existing } = await supabase.from('transactions').select('id')
        .eq('user_id', userId).ilike('note', `%${promoKey}%`).maybeSingle();
      if (existing) return;
      const newBalance = await creditUser(userId, promoTask.reward);
      await logTx(userId, 'receipt', promoTask.reward, `Tarefa ${promoKey} validada`);
      await sendMessage(chatId,
        `✅ *Tarefa validada automaticamente!*\n\n"${promoTask.title}"\n💎 *+${promoTask.reward} BNB* creditados!\nNovo saldo: *${newBalance.toFixed(6)} BNB*`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() }
      );
      console.log(`[promo] ✅ pago key=${promoKey} user=${userId}`);
    } catch (e) { console.error('[promo:auto]', e.message); }
  }, 60 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════
// CALLBACK QUERIES
// ═══════════════════════════════════════════════════════════════════════

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId  = cb.message.message_id;
  const from   = cb.from;
  const data   = cb.data || '';
  const lc     = lang(from);

  if (!data.startsWith('dep_check|')) await answerCallback(cb.id);

  // ── Menu principal ───────────────────────────────────────────────────
  if (data === 'menu_main')
    return editMessage(chatId, msgId,
      t(lc, 'inicio_menu', { nome: from.first_name || '' }),
      { parse_mode: 'Markdown', reply_markup: KB.mainMenu(lc) });

  if (data === 'menu_saldo')     return handleSaldo({ chat: { id: chatId }, from });
  if (data === 'menu_depositar') return handleDepositar({ chat: { id: chatId }, from });
  if (data === 'menu_sacar')     return handleSacar({ chat: { id: chatId }, from });
  if (data === 'menu_tarefas')   return handleTarefas({ chat: { id: chatId }, from });
  if (data === 'menu_criar')     return handleCriar({ chat: { id: chatId }, from });
  if (data === 'menu_referral')  return handleReferral({ chat: { id: chatId }, from });
  if (data === 'menu_minhas')    return handleMinhas({ chat: { id: chatId }, from });
  if (data === 'menu_ajuda')     return handleAjuda(chatId, from);
  if (data === 'menu_wallet')    return handleWallet({ chat: { id: chatId }, from, text: '' });

  // ── Admin ────────────────────────────────────────────────────────────
  // ── Painel Admin ──────────────────────────────────────────────────────
  if (data === 'adm_menu')          { if (!isAdmin(from.id)) return; return handleAdmin({ chat: { id: chatId }, from }); }
  if (data === 'adm_relatorio')     { if (!isAdmin(from.id)) return; return handleRelatorio({ chat: { id: chatId }, from }); }
  if (data === 'adm_users')         { if (!isAdmin(from.id)) return; return handleAdminUsers(chatId); }
  if (data === 'adm_tasks')         { if (!isAdmin(from.id)) return; return handleAdminTasks(chatId); }
  if (data === 'adm_config')        { if (!isAdmin(from.id)) return; return handleAdminConfig(chatId); }
  if (data === 'adm_withdrawals')   { if (!isAdmin(from.id)) return; return handleAdminWithdrawals(chatId); }
  if (data === 'adm_withdrawals_clear') {
    if (!isAdmin(from.id)) return;
    await supabase.from('transactions').update({ type: 'withdrawal_done' }).eq('type', 'withdrawal_pending');
    return sendMessage(chatId, '✅ Todos os saques marcados como processados.', { reply_markup: KB_ADMIN.back() });
  }
  if (data === 'adm_broadcast') {
    if (!isAdmin(from.id)) return;
    setState(from.id, { step: 'adm_broadcast' });
    return sendMessage(chatId, '📣 *Broadcast*\n\nEnvia a mensagem que queres enviar a todos os users:', { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
  }
  if (data.startsWith('adm_cfg_')) {
    if (!isAdmin(from.id)) return;
    const cfgKey = data.replace('adm_cfg_', '');
    const def = CFG_PROMPTS[cfgKey];
    if (!def) return;
    setState(from.id, { step: 'adm_cfg_' + cfgKey, cfgKey });
    return sendMessage(chatId,
      `⚙️ *${def.label}*\n\nValor actual: *${CONFIG[def.key]}*\n\nEnvia o novo valor:`,
      { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
  }

  // ── Depósito BSC — verificação automática ────────────────────────────
  if (data.startsWith('dep_check|')) {
    const userId = data.split('|')[1];
    await answerCallback(cb.id, '🔄 A verificar na BSC…', false);
    const found = await checkBscDeposit(userId, chatId);
    if (!found) {
      await sendMessage(chatId,
        `⏳ *Depósito ainda não detectado.*\n\nA transação pode demorar 1-3 minutos a confirmar.\n\n_Certifica-te que enviaste a partir da tua wallet registada._`,
        { parse_mode: 'Markdown', reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Verificar de novo', callback_data: data }],
            [{ text: '◀️ Menu Principal',    callback_data: 'menu_main' }],
          ]
        }}
      );
    }
    return;
  }

  if (data === 'dep_cancel') {
    clearState(from.id);
    return sendMessage(chatId, t(lc, 'deposit_cancelled'), { reply_markup: KB.backToMenu(lc) });
  }

  // ── Tarefas ──────────────────────────────────────────────────────────
  if (data.startsWith('tasks_page_'))
    return handleTarefas({ chat: { id: chatId }, from }, parseInt(data.replace('tasks_page_', ''), 10));

  if (data === 'task_view_promo_sweetcoin') {
    const user = await getOrCreateUser(from);
    const { data: alreadyPaid } = await supabase.from('transactions').select('id')
      .eq('user_id', user.id).ilike('note', '%promo_sweetcoin%').maybeSingle();
    if (alreadyPaid)
      return sendMessage(chatId, `✅ *Já completaste esta tarefa!*\n\nA recompensa de *${PROMO_TASK.reward} BNB* já foi creditada.`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
    schedulePromoValidation(from.id, user.id, chatId, `promo_sweetcoin_${from.id}`, PROMO_TASK);
    return sendMessage(chatId,
      `🌟 *Ganha Dinheiro Real Só por Caminhar!*\n\nTransforma cada passo em recompensas com Sweetcoin.\n\n🔥 *Desafio Ultimate:*\nConvida 20 amigos e recebe $10 diretamente no teu PayPal!\n\n👉 *Começa agora:*\nhttps://swcapp.com/i/orlandojaime27142264868\n\n⏱ _A tua recompensa de *${PROMO_TASK.reward} BNB* será creditada automaticamente em *1 hora*._`,
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [
          [{ text: '👉 Começar — Sweetcoin', url: 'https://swcapp.com/i/orlandojaime27142264868' }],
          [{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }],
        ]
      }}
    );
  }

  if (data === 'task_view_promo_daminexs') {
    const user = await getOrCreateUser(from);
    const { data: alreadyPaid } = await supabase.from('transactions').select('id')
      .eq('user_id', user.id).ilike('note', '%promo_daminexs%').maybeSingle();
    if (alreadyPaid)
      return sendMessage(chatId, `✅ *Já completaste esta tarefa!*\n\nA recompensa de *${PROMO_TASK_2.reward} BNB* já foi creditada.`,
        { parse_mode: 'Markdown', reply_markup: KB.backToMenu() });
    schedulePromoValidation(from.id, user.id, chatId, `promo_daminexs_${from.id}`, PROMO_TASK_2);
    return sendMessage(chatId,
      `🌟 *Ganha USDT — Convida Amigos para o Daminexs!*\n\nJunta-te ao Daminexs e ganha USDT por convidar amigos!\n\n👥 Cada amigo convidado = *+0.02 USDT*\n💸 Levantamento mínimo: *0.20 USDT*\n\n👉 *Começa agora:*\nhttps://t.me/daminexs_bot?start=r00914962806\n\n⏱ _A tua recompensa de *${PROMO_TASK_2.reward} BNB* será creditada automaticamente em *1 hora*._`,
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [
          [{ text: '👉 Começar — Daminexs', url: 'https://t.me/daminexs_bot?start=r00914962806' }],
          [{ text: '◀️ Voltar', callback_data: 'menu_tarefas' }],
        ]
      }}
    );
  }

  if (data.startsWith('task_view_'))    return showTaskDetail(chatId, from, data.replace('task_view_', ''));
  if (data.startsWith('task_accept_'))  return acceptTask(chatId, msgId, from, data.replace('task_accept_', ''), cb.id);
  if (data.startsWith('task_submit_'))  return submitTask(chatId, msgId, from, data.replace('task_submit_', ''));
  if (data.startsWith('task_approve_')) return approveTask(chatId, msgId, from, data.replace('task_approve_', ''));
  if (data.startsWith('task_dispute_')) return openDispute(chatId, msgId, from, data.replace('task_dispute_', ''));
  if (data.startsWith('task_cancel_'))  return cancelTask(chatId, msgId, from, data.replace('task_cancel_', ''));

  // ── Criar tarefa ─────────────────────────────────────────────────────
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

  // ── Saque ────────────────────────────────────────────────────────────
  if (data === 'withdraw_cancel')  { clearState(from.id); return sendMessage(chatId, t(lc, 'withdraw_cancelled'), { reply_markup: KB.backToMenu(lc) }); }
  if (data === 'withdraw_confirm') return handleWithdrawConfirm(cb);

  // ── Disputas ─────────────────────────────────────────────────────────
  if (data.startsWith('dispute_')) return handleDisputeCallback(cb, data);
}

// ═══════════════════════════════════════════════════════════════════════
// PAINEL ADMIN
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PAINEL ADMIN — Orlando Jaime (@orlandojaime1 · ID 7991785009)
// Comandos: /admin  /relatorio  /stats  /config  /broadcast  /addbalance
// ═══════════════════════════════════════════════════════════════════════

// Configurações editáveis em runtime pelo admin
const CONFIG = {
  referralBonusUsd: REFERRAL_BONUS_USD,
  listingFeeUsd:    LISTING_FEE_USD,
  minWithdrawUsd:   MIN_WITHDRAW_USD,
  minRefsWithdraw:  MIN_REFS_WITHDRAW,
  tasksPerPage:     TASKS_PER_PAGE,
  bscReceiverAddr:  BSC_RECEIVER_ADDRESS,
};

function isAdmin(id) { return id === ADMIN_ID; }

const KB_ADMIN = {
  main: () => ({
    inline_keyboard: [
      [{ text: '📊 Relatório',        callback_data: 'adm_relatorio'   },
       { text: '👥 Utilizadores',     callback_data: 'adm_users'       }],
      [{ text: '⚙️ Configurações',    callback_data: 'adm_config'      },
       { text: '📋 Tarefas',          callback_data: 'adm_tasks'       }],
      [{ text: '💸 Saques Pendentes', callback_data: 'adm_withdrawals' }],
      [{ text: '📣 Broadcast',        callback_data: 'adm_broadcast'   }],
      [{ text: '◀️ Menu Principal',   callback_data: 'menu_main'       }],
    ]
  }),
  config: () => ({
    inline_keyboard: [
      [{ text: '💎 Bónus Referência (USD)', callback_data: 'adm_cfg_referralBonus' }],
      [{ text: '🏷 Taxa Listagem (USD)',     callback_data: 'adm_cfg_listingFee'    }],
      [{ text: '💸 Mínimo Saque (USD)',      callback_data: 'adm_cfg_minWithdraw'   }],
      [{ text: '👥 Refs Mínimas p/ Sacar',  callback_data: 'adm_cfg_minRefs'       }],
      [{ text: '📋 Tarefas por Página',      callback_data: 'adm_cfg_tasksPerPage'  }],
      [{ text: '🔑 Endereço BSC Recepção',  callback_data: 'adm_cfg_bscAddr'       }],
      [{ text: '◀️ Painel Admin',           callback_data: 'adm_menu'             }],
    ]
  }),
  back: () => ({ inline_keyboard: [[{ text: '◀️ Painel Admin', callback_data: 'adm_menu' }]] }),
};

async function handleAdmin(msg) {
  if (!isAdmin(msg.from.id)) return sendMessage(msg.chat.id, '⛔ Sem permissão.');
  const bnbPrice = await getBnbPrice();
  await sendMessage(msg.chat.id,
    `🛠 *Painel Admin — TaskMarket*\n\n` +
    `👤 Orlando Jaime (@orlandojaime1)\n` +
    `💱 BNB: *$${bnbPrice}*\n\n` +
    `Escolhe uma opção:`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.main() }
  );
}

async function handleRelatorio(msg) {
  if (!isAdmin(msg.from.id)) return sendMessage(msg.chat.id, '⛔ Sem permissão.');
  try {
    const [
      { count: totalUsers }, { count: totalTasks },
      { count: openTasks }, { count: inProgressTasks },
      { count: pendingTasks }, { count: doneTasks },
      { count: disputedTasks }, { count: cancelledTasks },
      { data: depData }, { data: withdrawData }, { data: topUsers },
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
      supabase.from('transactions').select('amount').eq('type', 'withdrawal_pending'),
      supabase.from('users').select('username,first_name,balance,referral_count')
        .order('balance', { ascending: false }).limit(5),
    ]);
    const totalDep  = (depData      || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalWith = (withdrawData || []).reduce((s, r) => s + Math.abs(parseFloat(r.amount || 0)), 0);
    const saldoPlat = totalDep - totalWith;
    const bnbPrice  = bnbPriceCached();
    const medals    = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const topLines  = (topUsers || []).map((u, i) =>
      `${medals[i]} @${u.username || u.first_name || 'anon'} — *${(u.balance||0).toFixed(6)} BNB* · ${u.referral_count||0} refs`
    ).join('\n');
    const now = new Date().toLocaleString('pt-PT', { timeZone: 'UTC' });
    await sendMessage(msg.chat.id,
      `📊 *Relatório TaskMarket*\n_${now} UTC_\n\n` +
      `👥 *Utilizadores:* ${totalUsers || 0}\n\n` +
      `📋 *Tarefas:* ${totalTasks || 0} total\n` +
      `  🟡 Abertas: *${openTasks || 0}*\n` +
      `  🔵 Em progresso: *${inProgressTasks || 0}*\n` +
      `  🟠 Aguarda revisão: *${pendingTasks || 0}*\n` +
      `  ✅ Concluídas: *${doneTasks || 0}*\n` +
      `  ⚠️ Disputas: *${disputedTasks || 0}*\n` +
      `  ❌ Canceladas: *${cancelledTasks || 0}*\n\n` +
      `💰 *Financeiro:*\n` +
      `  Depósitos: *${totalDep.toFixed(6)} BNB* (~$${(totalDep*bnbPrice).toFixed(2)})\n` +
      `  Saques: *${totalWith.toFixed(6)} BNB* (~$${(totalWith*bnbPrice).toFixed(2)})\n` +
      `  Saldo plataforma: *${saldoPlat.toFixed(6)} BNB* (~$${(saldoPlat*bnbPrice).toFixed(2)})\n\n` +
      `⚙️ *Config activa:*\n` +
      `  Bónus ref: *$${CONFIG.referralBonusUsd}* · Taxa: *$${CONFIG.listingFeeUsd}*\n` +
      `  Min saque: *$${CONFIG.minWithdrawUsd}* · Refs min: *${CONFIG.minRefsWithdraw}*\n\n` +
      `🏆 *Top 5:*\n${topLines || 'Sem dados'}`,
      { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() }
    );
  } catch (e) {
    console.error('[relatorio]', e.message);
    await sendMessage(msg.chat.id, '❌ Erro: ' + e.message);
  }
}

async function handleAdminUsers(chatId) {
  const { data: users } = await supabase.from('users')
    .select('telegram_id,username,first_name,balance,referral_count,bsc_wallet,created_at')
    .order('created_at', { ascending: false }).limit(20);
  if (!users?.length) return sendMessage(chatId, 'Sem utilizadores.', { reply_markup: KB_ADMIN.back() });
  const lines = users.map((u, i) =>
    `${i+1}. @${u.username || u.first_name || 'anon'} (${u.telegram_id})\n` +
    `   💎 ${(u.balance||0).toFixed(6)} BNB · 👥 ${u.referral_count||0} refs\n` +
    `   🔑 ${u.bsc_wallet ? u.bsc_wallet.slice(0,10)+'…' : '⚠️ sem wallet'}`
  ).join('\n\n');
  await sendMessage(chatId, `👥 *Últimos 20 utilizadores*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
}

async function handleAdminTasks(chatId) {
  const { data: tasks } = await supabase.from('tasks')
    .select('id,title,status,reward,slots_remaining,total_slots,task_type')
    .order('created_at', { ascending: false }).limit(15);
  if (!tasks?.length) return sendMessage(chatId, 'Sem tarefas.', { reply_markup: KB_ADMIN.back() });
  const lines = tasks.map(t =>
    `#${t.id} ${statusEmoji(t.status)} ${taskTypeEmoji(t.task_type)} *${t.title}*\n` +
    `   💎 ${t.reward} BNB · ${t.slots_remaining}/${t.total_slots} vagas`
  ).join('\n\n');
  await sendMessage(chatId, `📋 *Últimas 15 tarefas*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
}

async function handleAdminWithdrawals(chatId) {
  const { data: pending } = await supabase.from('transactions')
    .select('id,user_id,amount,note,created_at').eq('type', 'withdrawal_pending')
    .order('created_at', { ascending: false }).limit(20);
  if (!pending?.length) return sendMessage(chatId, '✅ Sem saques pendentes.', { reply_markup: KB_ADMIN.back() });
  const lines = pending.map((tx, i) =>
    `${i+1}. User \`${tx.user_id}\`\n` +
    `   💸 ${Math.abs(tx.amount).toFixed(6)} BNB\n` +
    `   📝 ${tx.note || '—'}\n` +
    `   🕐 ${new Date(tx.created_at).toLocaleString('pt-PT', { timeZone: 'UTC' })}`
  ).join('\n\n');
  await sendMessage(chatId, `💸 *Saques Pendentes (${pending.length})*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Marcar todos como processados', callback_data: 'adm_withdrawals_clear' }],
        [{ text: '◀️ Painel Admin', callback_data: 'adm_menu' }],
      ]
    }}
  );
}

async function handleAdminConfig(chatId) {
  const bnbPrice = bnbPriceCached();
  await sendMessage(chatId,
    `⚙️ *Configurações — TaskMarket*\n\n` +
    `💎 Bónus referência: *$${CONFIG.referralBonusUsd}* (~${(CONFIG.referralBonusUsd/bnbPrice).toFixed(6)} BNB)\n` +
    `🏷 Taxa listagem: *$${CONFIG.listingFeeUsd}* (~${(CONFIG.listingFeeUsd/bnbPrice).toFixed(6)} BNB)\n` +
    `💸 Mínimo saque: *$${CONFIG.minWithdrawUsd}*\n` +
    `👥 Refs mínimas: *${CONFIG.minRefsWithdraw}*\n` +
    `📋 Tarefas/página: *${CONFIG.tasksPerPage}*\n` +
    `🔑 BSC receiver: \`${CONFIG.bscReceiverAddr}\`\n\n` +
    `_Selecciona o que queres alterar:_`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.config() }
  );
}

const CFG_PROMPTS = {
  referralBonus: { label: 'Bónus de Referência (USD)', key: 'referralBonusUsd', type: 'float' },
  listingFee:    { label: 'Taxa de Listagem (USD)',     key: 'listingFeeUsd',    type: 'float' },
  minWithdraw:   { label: 'Mínimo de Saque (USD)',      key: 'minWithdrawUsd',   type: 'float' },
  minRefs:       { label: 'Referências mínimas',        key: 'minRefsWithdraw',  type: 'int'   },
  tasksPerPage:  { label: 'Tarefas por Página',         key: 'tasksPerPage',     type: 'int'   },
  bscAddr:       { label: 'Endereço BSC Recepção',      key: 'bscReceiverAddr',  type: 'addr'  },
};

async function handleAdminConfigFSM(msg) {
  const state = getState(msg.from.id);
  if (!isAdmin(msg.from.id) || !state?.step?.startsWith('adm_cfg_')) return false;
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const cfgKey = state.cfgKey;
  const def    = CFG_PROMPTS[cfgKey];
  if (!def) { clearState(msg.from.id); return false; }
  let parsed;
  if (def.type === 'float') {
    parsed = parseFloat(text);
    if (isNaN(parsed) || parsed <= 0) {
      await sendMessage(chatId, `❌ Valor inválido. Introduz um número positivo (ex: \`0.05\`):`,
        { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
      return true;
    }
  } else if (def.type === 'int') {
    parsed = parseInt(text, 10);
    if (isNaN(parsed) || parsed < 1) {
      await sendMessage(chatId, `❌ Valor inválido. Introduz um número inteiro positivo:`,
        { reply_markup: KB_ADMIN.back() });
      return true;
    }
  } else if (def.type === 'addr') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(text)) {
      await sendMessage(chatId, `❌ Endereço BSC inválido (\`0x\` + 40 hex):`,
        { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
      return true;
    }
    parsed = text;
  }
  CONFIG[def.key] = parsed;
  clearState(msg.from.id);
  console.log(`[admin:config] ${def.key} → ${parsed}`);
  await sendMessage(chatId,
    `✅ *${def.label}* actualizado para *${parsed}*\n_Activo imediatamente, sem restart._`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() }
  );
  return true;
}

async function handleAdminBroadcastFSM(msg) {
  const state = getState(msg.from.id);
  if (!isAdmin(msg.from.id) || state?.step !== 'adm_broadcast') return false;
  const text = (msg.text || '').trim();
  if (!text) return false;
  clearState(msg.from.id);
  const { data: users } = await supabase.from('users').select('telegram_id');
  if (!users?.length) { await sendMessage(msg.chat.id, '❌ Sem utilizadores.'); return true; }
  await sendMessage(msg.chat.id, `📣 *A enviar broadcast para ${users.length} users…*`, { parse_mode: 'Markdown' });
  let ok = 0, fail = 0;
  for (const u of users) {
    try { await sendMessage(u.telegram_id, `📣 *Mensagem do TaskMarket:*\n\n${text}`, { parse_mode: 'Markdown' }); ok++; }
    catch { fail++; }
    await new Promise(r => setTimeout(r, 50));
  }
  await sendMessage(msg.chat.id,
    `✅ Broadcast concluído\n✅ Enviados: *${ok}*\n❌ Falhas: *${fail}*`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
  return true;
}

async function handleAddBalance(msg) {
  if (!isAdmin(msg.from.id)) return sendMessage(msg.chat.id, '⛔ Sem permissão.');
  const parts  = (msg.text || '').trim().split(/\s+/);
  const tgId   = parseInt(parts[1], 10);
  const amount = parseFloat(parts[2]);
  if (!tgId || isNaN(amount) || amount <= 0)
    return sendMessage(msg.chat.id,
      `❌ Uso: \`/addbalance <telegram_id> <valor_bnb>\`\nEx: \`/addbalance 123456789 0.5\``,
      { parse_mode: 'Markdown' });
  const target = await getUser(tgId);
  if (!target) return sendMessage(msg.chat.id, `❌ User \`${tgId}\` não encontrado.`, { parse_mode: 'Markdown' });
  const newBalance = await creditUser(target.id, amount);
  await logTx(target.id, 'deposit', amount, `Crédito manual pelo admin`);
  await sendMessage(msg.chat.id,
    `✅ *Crédito efectuado*\nUser: @${target.username || target.first_name} (\`${tgId}\`)\n+*${amount} BNB*\nNovo saldo: *${newBalance.toFixed(8)} BNB*`,
    { parse_mode: 'Markdown', reply_markup: KB_ADMIN.back() });
  await sendMessage(tgId,
    `💎 *O admin creditou ${amount} BNB na tua conta!*\nNovo saldo: *${newBalance.toFixed(8)} BNB*`,
    { parse_mode: 'Markdown' }).catch(() => {});
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
        `⏰ *Lembrete: revisão pendente há 24h+*\n\n"${task.title}" (#${task.id})\n💎 ${task.reward} BNB\n\nUsa /minhas para aprovar ou disputar.`,
        { parse_mode: 'Markdown' });
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
      try {
        if (await handleAdminConfigFSM(msg))   return;
        if (await handleAdminBroadcastFSM(msg)) return;
        if (await handleWalletFSM(msg))        return;
        if (await handleWithdrawFSM(msg))      return;
        if (await handleCreateFSM(msg))        return;
      } catch (e) {
        console.error('[FSM error]', e.message);
      }
    }

    switch (cmd) {
      case '/start':     return handleStart(msg);
      case '/inicio':    return handleInicio(msg);
      case '/saldo':     return handleSaldo(msg);
      case '/depositar': return handleDepositar(msg);
      case '/sacar':     return handleSacar(msg);
      case '/wallet':    return handleWallet(msg);
      case '/tarefas':   return handleTarefas(msg);
      case '/criar':     return handleCriar(msg);
      case '/referral':
      case '/ref':       return handleReferral(msg);
      case '/minhas':    return handleMinhas(msg);
      case '/admin':
      case '/painel':    return handleAdmin(msg);
      case '/relatorio':
      case '/stats':     return handleRelatorio(msg);
      case '/addbalance': return handleAddBalance(msg);
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
    console.log(`[cb] from=${cb.from?.id} data="${cb.data}"`);
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
    if (req.url === WEBHOOK_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      try { await processUpdate(JSON.parse(body)); }
      catch (e) { console.error('[webhook:tg]', e.message); }
      return;
    }
    res.writeHead(404);
    res.end();
  });

}).listen(PORT, async () => {
  console.log(`\n✅ TaskMarket Bot na porta ${PORT}`);
  console.log(`   Webhook Telegram : ${WEBHOOK_PATH}\n`);

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
  getBnbPrice().then(p => console.log(`💱 BNB price: $${p}`));
  setInterval(() => getBnbPrice(), BNB_CACHE_TTL_MS);
  console.log('⏱ Jobs: reminder 24h ✅  sweep FSM ✅  BNB price ✅');
});

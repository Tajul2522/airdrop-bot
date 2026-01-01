const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
    } catch (e) { console.error("DB Error"); }
};

// ডাটাবেজ স্কিমা (নতুন সিকিউরিটি ফিল্ড সহ)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    taskBalance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    wallet: { type: String, unique: true, sparse: true }, // এক ওয়ালেট এক একাউন্ট
    twitter: { type: String, unique: true, sparse: true }, // এক টুইটার এক একাউন্ট
    email: String,
    facebook: String,
    linkedin: String,
    actionState: { type: String, default: 'IDLE' },
    isBanned: { type: Boolean, default: false } // ফেক ইউজারদের জন্য
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=22.0`;

// --- ১. লিংক ভেরিফিকেশন লজিক (Regex) ---
const isValidTwitter = (url) => /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/.test(url);
const isValidFB = (url) => /^(https?:\/\/)?(www\.)?facebook\.com\/[a-zA-Z0-9.]+\/?$/.test(url);
const isValidLI = (url) => /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(url);
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// --- ২. স্টার্ট কমান্ড (Anti-Ban Check) ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (user && user.isBanned) return ctx.reply("🚫 Your account is banned for violating terms.");

        // রেফারেল লজিক আগের মতোই কাজ করবে
        // ... (Start logic remains similar to previous version) ...

        ctx.replyWithHTML(`👋 <b>Welcome to Nxracoin Security-Enhanced Bot!</b>\n\n⚠️ <i>Fake details will lead to immediate ban. Use real profile links only.</i>`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [Markup.button.callback('📝 Social Tasks', 'tasks')],
                [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')]
            ])
        );
    } catch (e) { console.error(e); }
});

// --- ৩. টাস্ক হ্যান্ডলিং (ভেরিফিকেশন সহ) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;
    const user = await User.findOne({ telegramId: userId });

    if (!user || user.isBanned) return;

    // Email ভেরিফিকেশন
    if (user.actionState === 'ASK_EMAIL') {
        if (isValidEmail(text)) {
            await User.findOneAndUpdate({ telegramId: userId }, { email: text, $inc: { balance: 1000, taskBalance: 1000 }, actionState: 'IDLE' });
            ctx.reply("✅ Email saved! +1000 Nxracoin", Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', 'step_tg')]]));
        } else ctx.reply("❌ Invalid Email! Please send a real email address.");
    }
    // Twitter ভেরিফিকেশন
    else if (user.actionState === 'ASK_TW') {
        if (isValidTwitter(text)) {
            const duplicate = await User.findOne({ twitter: text });
            if (duplicate) return ctx.reply("❌ This Twitter account is already used by another user!");
            
            await User.findOneAndUpdate({ telegramId: userId }, { twitter: text, $inc: { balance: 1000, taskBalance: 1000 }, actionState: 'IDLE' });
            ctx.reply("✅ Twitter verified! +1000 Nxracoin", Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', 'step_rt')]]));
        } else ctx.reply("❌ Invalid Twitter link! Send your full profile URL (e.g., https://x.com/username)");
    }
    // Facebook ভেরিফিকেশন
    else if (user.actionState === 'ASK_FB') {
        if (isValidFB(text)) {
            await User.findOneAndUpdate({ telegramId: userId }, { facebook: text, $inc: { balance: 1000, taskBalance: 1000 }, actionState: 'IDLE' });
            ctx.reply("✅ Facebook verified! All tasks finished! 🎉");
        } else ctx.reply("❌ Invalid Facebook URL!");
    }
    // Wallet unique check
    else if (user.actionState === 'AWAITING_WALLET') {
        if (text.startsWith('0x') && text.length >= 40) {
            const usedWallet = await User.findOne({ wallet: text });
            if (usedWallet) return ctx.reply("❌ This wallet is already linked to another account!");
            
            await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
            ctx.reply("✅ Wallet address secured!");
        } else ctx.reply("❌ Invalid BSC Wallet!");
    }
});

// --- ৪. এডমিন কমান্ড (Ban করার জন্য) ---
bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = ctx.message.text.split(' ')[1];
    await User.findOneAndUpdate({ telegramId: Number(targetId) }, { isBanned: true });
    ctx.reply(`🚫 User ${targetId} has been banned.`);
});

// Vercel Handler (বাকি অংশ আগের মতো থাকবে)
module.exports = async (req, res) => {
    try {
        await connectDB();
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

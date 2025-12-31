const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 

// ১. ডাটাবেজ কানেকশন (Optimized)
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000, // ১০ সেকেন্ড ওয়েট করবে
        });
        console.log("DB Connected");
    } catch (e) { console.error("DB Error:", e); }
};

// ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    twitter: { type: String, default: 'Not Submitted' },
    wallet: { type: String, default: null },
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    referralCount: { type: Number, default: 0 },
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=13.0";
const REFER_BONUS = 5000;

// --- স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                referredBy: refId && Number(refId) !== userId ? Number(refId) : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REFER_BONUS, referralCount: 1 } });
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'referral_info')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { ctx.reply("❌ Server busy. Please try /start again."); }
});

// --- ৩. রেফারেল তথ্য (Fast Fix) ---
bot.action('referral_info', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId }).lean();
        
        if (!user) return ctx.reply("❌ Please /start the bot first.");

        // এখানে আপনার বটের ইউজারনেম দিন (@ ছাড়া)
        const botUsername = "Nxracoin_bot"; // আপনার আসল বটের ইউজারনেম এখানে লিখে দিন
        
        const refLink = `https://t.me/${botUsername}?start=${userId}`;
        const totalCommission = (user.referralCount || 0) * REFER_BONUS;

        const refMsg = `👥 *Nxracoin Referral Program* 👥\n\n` +
            `🎁 *Referral Bonus:* ${REFER_BONUS} NXRA / Ref\n` +
            `📊 *Total Referrals:* ${user.referralCount || 0} Users\n` +
            `💰 *Total Commission:* ${totalCommission} NXRA\n\n` +
            `🔗 *Your Referral Link:* \n${refLink}`;

        await ctx.replyWithMarkdown(refMsg);
    } catch (e) {
        await ctx.reply("❌ Connection unstable. Please check your internet or try /start.");
    }
});

// --- ৪. উইথড্র মেনু ---
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id }).lean();
        const walletStatus = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
        ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n\n💰 *Balance:* ${user.balance} NXRA\n${walletStatus}`, Markup.inlineKeyboard([
            [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
            [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
        ]));
    } catch (e) { ctx.reply("❌ Error."); }
});

// মেসেজ হ্যান্ডলার ও অন্যান্য কমান্ড (আগের মতোই থাকবে)
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user && user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (text.startsWith('@')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { twitter: text });
        ctx.reply("✅ Twitter Saved!");
    }
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("✍️ Send your BEP-20 Wallet Address:");
});

// --- ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
    try {
        await connectDB();
        if (req.method === 'GET') {
            const { userId } = req.query;
            let user = await User.findOne({ telegramId: Number(userId) }).lean();
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            return res.status(200).json({ balance: user.balance, lastMining: user.lastMining ? new Date(user.lastMining).getTime() : 0 });
        }
        if (req.method === 'POST' && req.body.action === 'claim') {
            const { userId } = req.body;
            let user = await User.findOne({ telegramId: Number(userId) });
            const now = new Date();
            if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: now });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

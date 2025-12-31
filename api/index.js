const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; // আপনার বটের ইউজারনেম (@ ছাড়া)

// ১. ডাটাবেজ কানেকশন
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
    } catch (e) { console.error("MongoDB Error"); }
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    wallet: { type: String, default: null },
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=16.0";

// --- ৩. রেফারেল লজিক (একদম সিম্পল ও ফাস্ট) ---
bot.action('get_ref', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await connectDB();
        
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId });
        
        if (!user) return ctx.reply("❌ Please send /start again.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const earned = (user.referralCount || 0) * 5000;

        const msg = `👥 *Nxracoin Invite & Earn*\n\n` +
                    `🎁 *Per Referral:* 5000 NXRA\n` +
                    `📊 *Total Invited:* ${user.referralCount || 0}\n` +
                    `💰 *Total Earned:* ${earned} NXRA\n\n` +
                    `🔗 *Your Referral Link:*\n${refLink}`;

        await ctx.replyWithMarkdown(msg);
    } catch (e) {
        console.error(e);
        await ctx.reply("❌ Error loading referral data. Please try again in 10 seconds.");
    }
});

// --- ৪. মেইন মেনু এবং স্টার্ট ---
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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000, referralCount: 1 } });
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

// --- ৫. অন্যান্য ফাংশন (উইথড্র, বোনাস ইত্যাদি) ---
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n\n💰 *Balance:* ${user.balance} NXRA\n${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 Bonus claimed! +500 Nxracoin");
    } else ctx.reply("❌ Already claimed today!");
});

// মেসেজ লিসেনার (টুইটার, ওয়ালেট, উইথড্র এমাউন্ট)
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `🚀 *Withdraw!* @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid amount.");
    } else if (text.startsWith('@')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { twitter: text });
        ctx.reply("✅ Twitter Username Saved!");
    }
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter Nxracoin amount to withdraw:");
});

bot.action('tasks', (ctx) => { ctx.answerCbQuery(); ctx.reply("📋 Tasks: Join @YourChannel and Follow Twitter."); });
bot.action('support', (ctx) => { ctx.answerCbQuery(); ctx.reply("☎️ Support: @YourAdmin"); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE' });
    ctx.reply("✅ Reset!");
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
            if (!user.lastMining || (new Date().getTime() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: new Date() });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

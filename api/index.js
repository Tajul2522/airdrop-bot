const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 
const REQUIRED_CHANNEL = "@YourChannel"; // আপনার চ্যানেলের ইউজারনেম দিন

// ১. ডাটাবেজ কানেকশন লজিক
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        console.log("MongoDB Connected");
    } catch (e) { console.error("Database Connection Failed"); }
};

// ২. ডাটাবেজ মডেল
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

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=15.0";

// --- ৩. নতুন রেফারেল লজিক (সম্পূর্ণ নতুন ভাবে তৈরি) ---
bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery(); // বাটন লোডিং বন্ধ করা
    try {
        await connectDB();
        const userId = ctx.from.id;
        
        // ডাটাবেজ থেকে ইউজার সংগ্রহ
        const user = await User.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ User data not found. Please /start again.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const totalEarned = (user.referralCount || 0) * 5000;

        const refMessage = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
            `🎁 *Reward per Friend:* 5000 NXRA\n` +
            `📊 *Total Invited:* ${user.referralCount || 0} Users\n` +
            `💰 *Referral Rewards:* ${totalEarned} Nxracoin\n\n` +
            `🔗 *Your Unique Link:* \n${refLink}\n\n` +
            `📢 Share this link to grow your balance faster! 💸`;

        await ctx.replyWithMarkdown(refMessage, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (error) {
        console.error("Referral System Error:", error);
        await ctx.reply("❌ System Busy. Please try again after 5 seconds.");
    }
});

// --- ৪. মেনু এবং স্টার্ট কমান্ড ---
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

        const welcomeText = `👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Mine daily, complete tasks, and invite friends to earn big!`;

        ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')], // নতুন বাটন আইডি
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

// --- ৫. অন্যান্য অ্যাকশন (সব ফিক্সড) ---
bot.action('back_home', (ctx) => ctx.reply("Returning... Use /start to see menu."));

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

bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw Alert: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid amount.");
    } else if (text.startsWith('@')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { twitter: text });
        ctx.reply("✅ Twitter Saved!");
    }
});

bot.action('ask_wallet', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet:");
});

bot.action('ask_amount', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter amount to withdraw:");
});

bot.action('bonus', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('tasks', (ctx) => ctx.reply("Mandatory Tasks: Join @YourChannel\nSubmit Twitter username starting with @"));
bot.action('support', (ctx) => ctx.reply("Support: @YourAdmin"));

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

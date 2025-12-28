const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; // আপনার এডমিন আইডি

// Database Schema (300k+ Optimized)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

const MINING_REWARD = 1000;
const DAILY_BONUS = 500;
const REFERRAL_BONUS = 5000;
const WEB_APP_URL = 'https://airdrop-bot-nine.vercel.app/mining.html';

// --- ADMIN COMMANDS ---
bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    ctx.replyWithMarkdown(`👑 *Admin Panel*\n\n📊 Total Users: ${total}\n\nCommands:\n/stats - User statistics\n/reset - Reset your mining timer\n/broadcast [msg] - Send message to all`);
});

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null });
    ctx.reply("✅ Your mining timer has been reset for testing!");
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 Current Users in Database: ${count}`);
});

// --- USER COMMANDS ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;

    try {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username,
                referredBy: refId && refId != userId ? refId : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REFERRAL_BONUS } });
            }
        }

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!*\n\n🚀 Complete all tasks to earn Nxracoin.\n💸 Earn *${REFERRAL_BONUS} Nxracoin* for every friend you invite!`;

        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)],
                [
                    Markup.button.callback('📝 Start Task', 'tasks'),
                    Markup.button.callback('🎁 Daily Bonus', 'bonus')
                ],
                [
                    Markup.button.callback('💳 Withdraw', 'withdraw'),
                    Markup.button.callback('💰 Your Balance', 'balance')
                ],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); }
});

// Handling Callbacks (Bonus, Balance, etc.)
bot.action('bonus', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now - new Date(user.lastDailyBonus) > 24 * 60 * 60 * 1000)) {
        user.balance += DAILY_BONUS;
        user.lastDailyBonus = now;
        await user.save();
        ctx.answerCbQuery(`🎁 ${DAILY_BONUS} Nxracoin added!`, { show_alert: true });
    } else {
        ctx.answerCbQuery(`❌ Already claimed. Come back tomorrow!`, { show_alert: true });
    }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`💰 *Your Nxracoin Balance:* \n\n💵 *Total:* ${user ? user.balance : 0} Nxracoin\n👥 *Referral Bonus:* ${REFERRAL_BONUS} / Ref\n\n🔗 *Your Referral Link:* \n${refLink}`);
});

bot.action('tasks', (ctx) => ctx.reply('📋 *Complete Tasks:*\n1. Join @YourChannel\n2. Join @YourGroup'));
bot.action('withdraw', (ctx) => ctx.reply('🏦 Minimum Withdrawal: 100,000 Nxracoin'));
bot.action('support', (ctx) => ctx.reply('☎️ Contact: @YourSupportAdmin'));

// --- VERCEL HANDLER (API + Webhook) ---
module.exports = async (req, res) => {
    if (req.method === 'GET') {
        const { userId } = req.query;
        let user = await User.findOne({ telegramId: Number(userId) });
        return res.status(200).json(user || { balance: 0, lastMining: 0 });
    }

    if (req.method === 'POST' && req.body.action === 'claim') {
        const { userId } = req.body;
        let user = await User.findOne({ telegramId: Number(userId) });
        const now = new Date();
        const waitTime = 12 * 60 * 60 * 1000;

        if (!user.lastMining || (now - new Date(user.lastMining) > waitTime)) {
            user.balance += MINING_REWARD;
            user.lastMining = now;
            await user.save();
            return res.status(200).json({ success: true, balance: user.balance, lastMining: user.lastMining.getTime() });
        }
        return res.status(400).json({ success: false });
    }

    if (req.method === 'POST') {
        try { await bot.handleUpdate(req.body); res.status(200).send('OK'); } catch (e) { res.status(200).send('OK'); }
    } else {
        res.status(200).send('Bot Running');
    }
};

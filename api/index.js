const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797;

// Database Schema
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

// Web App URL with Cache Breaker
const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=3.0";

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;

    try {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', referredBy: refId && Number(refId) !== userId ? Number(refId) : null });
            await user.save();
            if (user.referredBy) await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000 } });
        }

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*\n\n🚀 Earn Nxracoin daily and invite friends!`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [Markup.button.callback('📝 Start Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
                [Markup.button.callback('🏦 Withdraw', 'withdraw'), Markup.button.callback('💰 Balance', 'balance')],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); }
});

// Admin Reset Command
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null });
    ctx.reply("✅ Admin: Your Mining Timer Reset!");
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.reply(`💰 Your Balance: ${user ? user.balance : 0} Nxracoin`);
});

// Vercel Handler
module.exports = async (req, res) => {
    if (req.method === 'GET') {
        const { userId } = req.query;
        let user = await User.findOne({ telegramId: Number(userId) });
        if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
        return res.status(200).json({ balance: user.balance, lastMining: user.lastMining ? new Date(user.lastMining).getTime() : 0 });
    }
    if (req.method === 'POST' && req.body.action === 'claim') {
        const { userId } = req.body;
        let user = await User.findOne({ telegramId: Number(userId) });
        const now = new Date();
        if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > 12*60*60*1000)) {
            user.balance += 1000;
            user.lastMining = now;
            await user.save();
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ success: false });
    }
    if (req.method === 'POST') {
        try { await bot.handleUpdate(req.body); res.status(200).send('OK'); } catch (e) { res.status(200).send('OK'); }
    } else { res.status(200).send('Bot Active'); }
};

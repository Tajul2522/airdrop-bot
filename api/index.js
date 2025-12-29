const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 

// ১. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ২. ডাটাবেজ কানেকশন
mongoose.connect(process.env.MONGO_URI);

// --- এডমিন কমান্ড ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null });
    ctx.reply("✅ Admin: Mining timer reset! Please open the app now.");
});

// --- বটের স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;
    
    // ফাইলের নাম বদলে app.html করা হয়েছে এবং ভার্সন v=1.5 দেওয়া হয়েছে
    const WEB_APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=1.5`;

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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000 } });
            }
        }
        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)],
                [Markup.button.callback('💰 Balance', 'balance')]
            ])
        );
    } catch (e) { console.error(e); }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.reply(`💰 Balance: ${user ? user.balance : 0} Nxracoin`);
});

// --- ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
    if (req.method === 'GET') {
        const { userId } = req.query;
        try {
            let user = await User.findOne({ telegramId: Number(userId) });
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            const lastTime = user.lastMining ? new Date(user.lastMining).getTime() : 0;
            return res.status(200).json({ balance: user.balance, lastMining: lastTime });
        } catch (e) { return res.status(500).json({ error: "Server Error" }); }
    }
    if (req.method === 'POST' && req.body.action === 'claim') {
        const { userId } = req.body;
        try {
            let user = await User.findOne({ telegramId: Number(userId) });
            const now = new Date();
            if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > 12*60*60*1000)) {
                user.balance += 1000;
                user.lastMining = now;
                await user.save();
                return res.status(200).json({ success: true, balance: user.balance, lastMining: user.lastMining.getTime() });
            }
            return res.status(400).json({ success: false });
        } catch (e) { return res.status(500).json({ error: "Server Error" }); }
    }
    if (req.method === 'POST') {
        try { await bot.handleUpdate(req.body); res.status(200).send('OK'); } catch (e) { res.status(200).send('OK'); }
    } else { res.status(200).send('Running'); }
};

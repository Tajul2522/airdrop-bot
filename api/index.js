const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Database Schema
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    lastMining: { type: Date, default: 0 }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

// Web App URL
const WEB_APP_URL = 'https://airdrop-bot-nine.vercel.app/mining.html';

bot.start(async (ctx) => {
    // ... আপনার আগের স্টার্ট কমান্ডের লজিক ঠিক থাকবে ...
    ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, 
        Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)],
            [Markup.button.callback('💰 Your Balance', 'balance')]
        ])
    );
});

// Vercel Handler (Handling both Bot and API requests)
module.exports = async (req, res) => {
    // 1. Handle Web App API Requests
    if (req.method === 'GET' && req.query.userId) {
        const user = await User.findOne({ telegramId: req.query.userId });
        return res.status(200).json(user || { balance: 0, lastMining: 0 });
    }

    if (req.method === 'POST' && req.body.action === 'claim') {
        const { userId } = req.body;
        const user = await User.findOne({ telegramId: userId });
        const now = new Date();
        if (now - new Date(user.lastMining) > 12 * 60 * 60 * 1000) {
            user.balance += 1000;
            user.lastMining = now;
            await user.save();
            return res.status(200).json({ success: true, balance: user.balance });
        }
        return res.status(400).json({ success: false });
    }

    // 2. Handle Telegram Webhook
    if (req.method === 'POST') {
        await bot.handleUpdate(req.body);
        return res.status(200).send('OK');
    }

    res.status(200).send('Bot and API Running');
};

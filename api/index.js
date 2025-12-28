const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Database Schema
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    wallet: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: 0 }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

const WEB_APP_URL = 'https://airdrop-bot-nine.vercel.app/mining.html';

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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000 } });
            }
        }

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!*\n\n🚀 Complete all tasks to earn Nxracoin.\n💸 Earn *5000 Nxracoin* for every friend you invite!`;

        // WebApp Button Setup
        return ctx.replyWithMarkdown(welcomeMsg, 
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
    } catch (e) { 
        console.error(e); 
        return ctx.reply('An error occurred. Please try again later.');
    }
});

// Basic Actions to keep bot responsive
bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.reply(`💰 Balance: ${user ? user.balance : 0} Nxracoin`);
});

bot.action('tasks', (ctx) => ctx.reply('📋 Complete Tasks: @YourChannel'));

// Vercel Handler
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } catch (err) {
            console.error(err);
            res.status(200).send('OK');
        }
    } else {
        res.status(200).send('Bot is Running');
    }
};

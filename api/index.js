const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Database Schema
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    wallet: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 10 } });
            }
        }
        
        ctx.replyWithMarkdown(`👋 *Welcome to the Official Airdrop!* \n\nComplete all tasks to earn rewards.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🚀 Join Airdrop Tasks', 'tasks')],
                [Markup.button.callback('💰 Balance & Referral', 'balance')],
                [Markup.button.callback('💳 Submit Wallet', 'wallet')]
            ])
        );
    } catch (e) { console.log(e); }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`👤 *User:* @${ctx.from.username || 'User'}\n💵 *Balance:* ${user ? user.balance : 0} Points\n\n🔗 *Referral Link:* \n${refLink}`);
});

bot.action('tasks', (ctx) => {
    ctx.replyWithMarkdown(`📢 *Tasks:*\n\n1. Join @YourChannel\n2. Join @YourGroup\n\nClick "Verify" after joining.`);
});

bot.action('wallet', (ctx) => {
    ctx.reply('Please send your *BEP-20 (BSC) Wallet Address* as a text message.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('0x') && text.length === 42) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text });
        ctx.reply('✅ Wallet address saved!');
    }
});

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } catch (err) { res.status(200).send('OK'); }
    } else {
        res.status(200).send('Bot Running');
    }
};

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
    lastMining: { type: Date, default: 0 },
    lastDailyBonus: { type: Date, default: 0 }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

const REFERRAL_BONUS = 5000;
const DAILY_BONUS = 500;

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

        // Updated Layout with WebApp for Mining
        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', `https://${process.env.VERCEL_URL}/mining.html`) || Markup.button.callback('⛏️ Start Daily Mining', 'mining')], 
                [
                    Markup.button.callback('📝 Start/Complete Task', 'tasks'),
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

// Daily Bonus, Balance, Tasks etc. remains same as before...
bot.action('bonus', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (now - new Date(user.lastDailyBonus) > 24 * 60 * 60 * 1000) {
        user.balance += DAILY_BONUS;
        user.lastDailyBonus = now;
        await user.save();
        ctx.answerCbQuery(`🎁 ${DAILY_BONUS} Nxracoin added!`, { show_alert: true });
    } else {
        ctx.answerCbQuery(`❌ Come back tomorrow!`, { show_alert: true });
    }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`💰 *Your Nxracoin Balance:* \n\n💵 *Total:* ${user.balance} Nxracoin\n👥 *Referral:* ${REFERRAL_BONUS} / Ref\n\n🔗 *Ref Link:* \n${refLink}`);
});

bot.action('tasks', (ctx) => {
    ctx.replyWithMarkdown(`📋 *Nxracoin Tasks:*\n\n1️⃣ Join @YourChannel\n2️⃣ Join @YourGroup\n\nClick "Submit Details" to verify.`);
});

bot.action('withdraw', (ctx) => ctx.reply('🏦 Minimum 100,000 Nxracoin required.'));
bot.action('support', (ctx) => ctx.reply('☎️ Support: @YourAdmin'));

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } else {
        res.status(200).send('Bot is Running');
    }
};

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 300k+ Optimized Database Schema
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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

// Constants
const MINING_REWARD = 1000;
const DAILY_BONUS = 500;
const REFERRAL_BONUS = 5000;

// Start Command
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

        // Your Requested Layout
        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.callback('⛏️ Start Daily Mining', 'mining')], // Top Center
                [
                    Markup.button.callback('📝 Start/Complete Task', 'tasks'), // Top Left
                    Markup.button.callback('🎁 Daily Bonus', 'bonus')       // Top Right
                ],
                [
                    Markup.button.callback('💳 Withdraw', 'withdraw'),       // Center Left
                    Markup.button.callback('💰 Your Balance', 'balance')     // Center Right
                ],
                [Markup.button.callback('☎️ Support', 'support')]           // Bottom Center
            ])
        );
    } catch (e) { console.error(e); }
});

// 1. Daily Mining Logic (12 Hours)
bot.action('mining', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    const waitTime = 12 * 60 * 60 * 1000; // 12 hours

    if (now - new Date(user.lastMining) > waitTime) {
        user.balance += MINING_REWARD;
        user.lastMining = now;
        await user.save();
        ctx.answerCbQuery(`✅ Success! You got ${MINING_REWARD} Nxracoin`, { show_alert: true });
    } else {
        const remaining = new Date(user.lastMining.getTime() + waitTime) - now;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        ctx.answerCbQuery(`⏳ Mining in progress. Come back in ${hours} hours.`, { show_alert: true });
    }
});

// 2. Daily Bonus Logic (24 Hours)
bot.action('bonus', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    const waitTime = 24 * 60 * 60 * 1000;

    if (now - new Date(user.lastDailyBonus) > waitTime) {
        user.balance += DAILY_BONUS;
        user.lastDailyBonus = now;
        await user.save();
        ctx.answerCbQuery(`🎁 Daily Bonus: ${DAILY_BONUS} Nxracoin added!`, { show_alert: true });
    } else {
        ctx.answerCbQuery(`❌ Already claimed. Come back tomorrow!`, { show_alert: true });
    }
});

// 3. Balance & Referral Logic
bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    
    const msg = `💰 *Your Nxracoin Balance:* \n\n💵 *Total:* ${user.balance} Nxracoin\n👥 *Referral Bonus:* ${REFERRAL_BONUS} Nxracoin / Ref\n\n🔗 *Your Referral Link:* \n${refLink}`;
    ctx.replyWithMarkdown(msg);
});

// 4. Tasks Menu
bot.action('tasks', (ctx) => {
    const taskList = `📋 *Nxracoin Task List:*\n\n1️⃣ Join Channel: @YourChannel\n2️⃣ Join Group: @YourGroup\n3️⃣ Follow Twitter: [Link]\n\n⚠️ *Note:* Submit your details correctly or you won't get rewards!`;
    ctx.replyWithMarkdown(taskList, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Submit Task Details', 'submit_details')]
        ])
    );
});

// 5. Withdraw & Support
bot.action('withdraw', (ctx) => ctx.reply('🏦 *Withdrawal:* Minimum 100,000 Nxracoin required to withdraw.'));
bot.action('support', (ctx) => ctx.reply('☎️ *Contact Support:* @YourAdminUsername'));

// Vercel Handler
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } catch (err) { res.status(200).send('OK'); }
    } else {
        res.status(200).send('Nxracoin Bot Online');
    }
};

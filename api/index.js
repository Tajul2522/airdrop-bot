const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 

// ১. ডাটাবেজ স্কিমা (Schema)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ২. ডাটাবেজ কানেকশন
mongoose.connect(process.env.MONGO_URI);

// রিওয়ার্ড কনস্ট্যান্ট
const MINING_REWARD = 1000; // 1000 Nxracoin
const DAILY_BONUS = 500;   // 500 Nxracoin
const REFER_BONUS = 5000;  // 5000 Nxracoin

// --- এডমিন কমান্ড (টেস্ট করার জন্য) ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null });
    ctx.reply("✅ Admin: All rewards timers have been reset for you! 🔄");
});

// --- স্টার্ট কমান্ড (ওয়েলকাম মেসেজ + মেনু) ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;

    try {
        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                referredBy: refId && Number(refId) !== userId ? Number(refId) : null
            });
            await user.save();

            // রেফারেল বোনাস যোগ করা
            if (user.referredBy) {
                await User.findOneAndUpdate(
                    { telegramId: user.referredBy }, 
                    { $inc: { balance: REFER_BONUS, referralCount: 1 } }
                );
            }
        }

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!* 🌟\n\n` +
            `🚀 *Get Ready to earn Nxracoin!*\n` +
            `💎 Complete simple tasks and earn points.\n` +
            `💸 Invite friends and get *${REFER_BONUS} Nxracoin* each!\n\n` +
            `👇 *Use the menu below to start earning:*`;

        // আপনার চাওয়া অনুযায়ী বাটন লেআউট
        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.callback('⛏️ Start Daily Mining', 'mining')], // উপরে মাঝখানে
                [
                    Markup.button.callback('📝 Start Tasks', 'tasks'),         // উপরে বাম দিকে
                    Markup.button.callback('🎁 Daily Bonus', 'bonus')        // উপরে ডান দিকে
                ],
                [
                    Markup.button.callback('🏦 Withdraw', 'withdraw'),       // মাঝখানে বাম দিকে
                    Markup.button.callback('💰 Your Balance', 'balance')     // মাঝখানে ডান দিকে
                ],
                [Markup.button.callback('☎️ Support', 'support')]           // নিচে মাঝখানে
            ])
        );
    } catch (e) { console.error(e); }
});

// --- ১. মাইনিং লজিক (১২ ঘণ্টা) ---
bot.action('mining', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    const waitTime = 12 * 60 * 60 * 1000; // 12 Hours

    if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > waitTime)) {
        user.balance += MINING_REWARD;
        user.lastMining = now;
        await user.save();
        ctx.answerCbQuery(`✅ Success! You mined ${MINING_REWARD} Nxracoin ⚡`, { show_alert: true });
    } else {
        const nextClaim = new Date(user.lastMining.getTime() + waitTime);
        const diff = nextClaim - now;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        ctx.answerCbQuery(`⏳ Mining in progress! Come back in ${hours}h ${mins}m.`, { show_alert: true });
    }
});

// --- ২. ডেইলি বোনাস লজিক (২৪ ঘণ্টা) ---
bot.action('bonus', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    const waitTime = 24 * 60 * 60 * 1000; // 24 Hours

    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > waitTime)) {
        user.balance += DAILY_BONUS;
        user.lastDailyBonus = now;
        await user.save();
        ctx.answerCbQuery(`🎁 Congratulations! You received ${DAILY_BONUS} Nxracoin! 🎊`, { show_alert: true });
    } else {
        ctx.answerCbQuery(`❌ Already claimed! Come back tomorrow.`, { show_alert: true });
    }
});

// --- ৩. ব্যালেন্স ও রেফারেল ---
bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    
    const balanceMsg = `💎 *Nxracoin Balance Dashboard* 💎\n\n` +
        `👤 *User:* @${ctx.from.username || 'User'}\n` +
        `💰 *Current Balance:* ${user.balance} Nxracoin\n` +
        `👥 *Total Referrals:* ${user.referralCount}\n` +
        `🎁 *Referral Reward:* ${REFER_BONUS} Nxracoin / Ref\n\n` +
        `🔗 *Your Referral Link:* \n${refLink}\n\n` +
        `📢 Share this link with your friends to earn more! 💸`;
    
    ctx.replyWithMarkdown(balanceMsg);
});

// --- ৪. টাস্ক মেনু (Submit Details অপশন সহ) ---
bot.action('tasks', (ctx) => {
    const taskList = `📋 *Nxracoin Mandatory Tasks:* 📋\n\n` +
        `1️⃣ Join our Telegram Channel: @YourChannel 📢\n` +
        `2️⃣ Join our Telegram Group: @YourGroup 👥\n` +
        `3️⃣ Follow us on Twitter: [Your Link] 🐦\n\n` +
        `⚠️ *Note:* You must complete all tasks and submit details correctly! ✍️`;

    ctx.replyWithMarkdown(taskList, 
        Markup.inlineKeyboard([
            [Markup.button.callback('✍️ Submit Task Details', 'submit_details')]
        ])
    );
});

// --- ৫. উইড্রো এবং সাপোর্ট ---
bot.action('withdraw', (ctx) => ctx.reply('🏦 *Nxracoin Withdrawal* 🏦\n\n❌ *Minimum Withdrawal:* 100,000 Nxracoin.\n⏳ Keep mining and referring to reach the goal! 🚀'));
bot.action('support', (ctx) => ctx.reply('☎️ *Nxracoin Support Center* ☎️\n\nIf you face any issues, contact us: @YourAdminUsername 👨‍💻'));

// --- ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } catch (err) { res.status(200).send('OK'); }
    } else {
        res.status(200).send('Nxracoin Bot is Live! 🚀');
    }
};

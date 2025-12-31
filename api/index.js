const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ডাটাবেজ কানেকশন (সহজ পদ্ধতি)
mongoose.connect(process.env.MONGO_URI);

// ডাটাবেজ স্কিমা
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

// --- স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;

    try {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let startBal = (refId && Number(refId) !== userId) ? 5000 : 0;
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: startBal,
                referredBy: (refId && Number(refId) !== userId) ? Number(refId) : null
            });
            await user.save();

            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000, referralCount: 1 } });
            }
        }

        const menu = Markup.inlineKeyboard([
            [Markup.button.callback('⛏️ Start Daily Mining', 'mining_msg')],
            [
                Markup.button.callback('📝 Social Tasks', 'tasks_msg'),
                Markup.button.callback('🎁 Daily Bonus', 'bonus_msg')
            ],
            [
                Markup.button.callback('🏦 Withdraw', 'withdraw_menu'),
                Markup.button.callback('👥 Referral', 'get_ref')
            ],
            [Markup.button.callback('☎️ Support', 'support_msg')]
        ]);

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Earn rewards by completing tasks and mining daily.`, menu);
    } catch (e) { console.log(e); }
});

// --- বাটন অ্যাকশনসমূহ ---
bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`👥 *Referral Program*\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Referral: 5000 NXRA\n📊 Total Invited: ${user.referralCount || 0}\n\n🔗 *Link:* \n${refLink}`);
});

bot.action('mining_msg', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastMining || (now - new Date(user.lastMining) > 43200000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 1000 }, lastMining: now });
        ctx.reply("✅ Mining Success! +1000 NXRA added to your balance. ⚡");
    } else {
        ctx.reply("⏳ Mining in progress! Please wait 12 hours.");
    }
});

bot.action('bonus_msg', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now - new Date(user.lastDailyBonus) > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA Daily Bonus Claimed! 🎊");
    } else { ctx.reply("❌ Already claimed! Come back tomorrow."); }
});

bot.action('tasks_msg', (ctx) => {
    ctx.answerCbQuery();
    ctx.replyWithMarkdown(`📋 *Social Tasks*\n\n1. Join Channel\n2. Join Group\n\nSubmit @username to earn 1000 NXRA.`);
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Withdrawal*\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${user.wallet || 'Not Set'}`);
});

bot.action('support_msg', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("☎️ Support: @tajul15");
});

// এডমিন রিসেট
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, balance: 0, referralCount: 0 });
    ctx.reply("✅ Data Reset Success!");
});

// --- ভার্সেল হ্যান্ডলার ---
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

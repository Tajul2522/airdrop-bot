const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন অপ্টিমাইজেশন (Vercel এর জন্য)
let cachedDb = null;
const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
    cachedDb = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
    });
    return cachedDb;
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    wallet: { type: String, default: null },
    actionState: { type: String, default: 'IDLE' },
    email: String, twitter: String, retweet: String, linkedin: String, facebook: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=21.0";
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. টাস্ক ও স্কিপ লজিক ফাংশন ---
const askStep = (ctx, text, nextAction) => {
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Skip This Task', nextAction)]
    ]));
};

// --- ৪. বটের মূল কমান্ডসমূহ ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let startBal = (refId && Number(refId) !== userId) ? JOIN_BONUS : 0;
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: startBal,
                referredBy: (refId && Number(refId) !== userId) ? Number(refId) : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(user.referredBy, `🎁 Someone joined! You earned ${REF_BONUS} NXRA.`).catch(()=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*\n\n🚀 Mine, complete tasks, and invite friends to earn big!`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
                [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); ctx.reply("❌ Connection error. Try /start again."); }
});

// টাস্ক অ্যাকশনসমূহ
bot.action('tasks', (ctx) => {
    ctx.answerCbQuery();
    ctx.replyWithMarkdown(`📋 *Nxracoin Social Tasks* (6,000 NXRA)\n\nComplete each task for 1,000 NXRA. Skip anytime.`, 
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_EMAIL'}).then(() => askStep(ctx, "📧 *Step 1:* Send your *Email*:", 'step_tg')); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_TG'}).then(() => askStep(ctx, "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *Send TG Username:*", 'step_twitter')); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_TW'}).then(() => askStep(ctx, "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 *Send Twitter Username:*", 'step_retweet')); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_RT'}).then(() => askStep(ctx, "🔥 *Step 4:* Like/RT [Post](https://x.com/Nxracoin/status/2006308628375245186)\n\n👇 *Send RT Link:*", 'step_linkedin')); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_LI'}).then(() => askStep(ctx, "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?)\n\n👇 *Send LinkedIn URL:*", 'step_facebook')); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_FB'}).then(() => askStep(ctx, "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 *Send FB URL:*", 'finish_tasks')); });

bot.action('finish_tasks', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'IDLE'}).then(() => ctx.reply("🎉 Tasks Finished!")); });

// রেফারেল ও অন্যান্য
bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`👥 *Invite & Earn*\n🎁 Referral: 5000 NXRA\n📊 Invited: ${user.referralCount}\n\n🔗 *Link:* \n${refLink}`);
});

bot.on('text', async (ctx) => {
    try {
        await connectDB();
        const text = ctx.message.text.trim();
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) return;

        const nextMap = { ASK_EMAIL: 'step_tg', ASK_TG: 'step_twitter', ASK_TW: 'step_retweet', ASK_RT: 'step_linkedin', ASK_LI: 'step_facebook', ASK_FB: 'finish_tasks' };
        
        if (nextMap[user.actionState]) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
            ctx.reply(`✅ Success! +1000 NXRA.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextMap[user.actionState])]]));
        } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
            ctx.reply("✅ Wallet Saved!");
        }
    } catch(e) {}
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now - user.lastDailyBonus > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Already claimed!");
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Balance:* ${user.balance} NXRA\n💳 *Wallet:* \`${user.wallet || 'Not Set'}\``, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'AWAITING_WALLET'}).then(() => ctx.reply("Send BEP-20 Wallet:")); });
bot.action('ask_amount', (ctx) => { ctx.answerCbQuery(); User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'AWAITING_AMOUNT'}).then(() => ctx.reply("Enter amount:")); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

// --- ৫. ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
    try {
        await connectDB();
        if (req.method === 'GET') {
            const { userId } = req.query;
            let user = await User.findOne({ telegramId: Number(userId) }).lean();
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            return res.status(200).json({ balance: user.balance, lastMining: user.lastMining ? new Date(user.lastMining).getTime() : 0 });
        }
        if (req.method === 'POST' && req.body.action === 'claim') {
            const { userId } = req.body;
            let user = await User.findOne({ telegramId: Number(userId) });
            if (!user.lastMining || (Date.now() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: new Date() });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { console.error(err); res.status(200).send('OK'); }
};

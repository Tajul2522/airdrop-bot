const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    } catch (e) { console.error("DB Error"); }
};

// 2. Database Schema (Added allTasksFinished)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    taskBalance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    wallet: { type: String, default: null },
    actionState: { type: String, default: 'IDLE' },
    allTasksFinished: { type: Boolean, default: false } // নতুন টাস্ক স্ট্যাটাস
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. মেইন মেনু কিবোর্ড (Reply Keyboard) ---
const mainMenu = Markup.keyboard([
    ['⛏️ Start Daily Mining'],
    ['📝 Social Tasks', '🎁 Daily Bonus'],
    ['🏦 Withdraw', '👥 Referral'],
    ['☎️ Support']
]).resize();

// --- ৪. স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let inviterId = (refId && Number(refId) !== userId) ? Number(refId) : null;
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: inviterId ? JOIN_BONUS : 0,
                referredBy: inviterId
            });
            await user.save();
            if (inviterId) {
                await User.findOneAndUpdate({ telegramId: inviterId }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(inviterId, `🎁 <b>Referral Bonus!</b> Someone joined via your link. You earned 5000 Nxracoin!`, {parse_mode: 'HTML'}).catch(()=>{});
                ctx.reply(`🎁 Welcome! You received 5000 Nxracoin bonus!`);
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithHTML(`👋 <b>Welcome to Nxracoin Reward Bot!</b>\n\n🚀 Earn Nxracoin daily by mining and complete tasks!`, mainMenu);
    } catch (e) { console.error(e); }
});

// --- ৫. সোশ্যাল টাস্ক হ্যান্ডলার (One-time Check) ---
bot.hears('📝 Social Tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    
    // টাস্ক কি আগে করা হয়েছে?
    if (user && user.allTasksFinished) {
        return ctx.replyWithHTML("✅ <b>You have already completed all social tasks!</b>\nRewards have been added to your balance. Start mining or refer friends to earn more! 🚀");
    }

    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks</b> (6,000 Total)\nEarn 1,000 per task. Reward for real details only.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

// সোশ্যাল টাস্ক ফ্লো
const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skip)]]));
};

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG @username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Twitter URL:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>Post</a>\nSend Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook</a>\nSend URL:", 'finish_tasks'); });

// টাস্ক শেষ করার লজিক
bot.action('finish_tasks', async (ctx) => {
    await ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE', allTasksFinished: true }, { new: true });
    const summary = `🎉 <b>Congratulations!</b>\n\n✅ You have finished all tasks.\n💰 Rewards: ${user.taskBalance} Nxracoin\n💵 Total Balance: ${user.balance} Nxracoin`;
    ctx.replyWithHTML(summary);
});

// --- ৬. মেসেজ লিসেনার (Text inputs) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    if (['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'].includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const steps = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook' };
    
    if (steps[user.actionState]) {
        const next = steps[user.actionState];
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 Nxracoin.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', next)]]));
    } else if (user.actionState === 'ASK_FB') {
        const finalUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE', allTasksFinished: true }, {new: true});
        ctx.replyWithHTML(`🎉 <b>Congratulations!</b>\nAll tasks completed.\n💰 Rewards: ${finalUser.taskBalance} Nxracoin.`);
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// --- ৭. অন্যান্য মেনু বাটন হ্যান্ডলিং ---
bot.hears('⛏️ Start Daily Mining', (ctx) => ctx.replyWithMarkdown(`🚀 *Open App* to start mining:`, Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]])));
bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 Nxracoin bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});
bot.hears('👥 Referral', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`👥 <b>Nxracoin Referral</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}`);
});
bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal Dashboard</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});
bot.hears('☎️ Support', (ctx) => ctx.reply("Support: @tajul15"));

// Callbacks
bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('back_home', (ctx) => ctx.reply("Returning... Use /start"));

// Admin Reset
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, taskBalance: 0, referralCount: 0, allTasksFinished: false });
    ctx.reply("✅ Data Reset Success!");
});

// Vercel Handler
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
            if (!user.lastMining || (new Date().getTime() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: new Date() });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

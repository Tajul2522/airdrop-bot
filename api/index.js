const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    } catch (e) { console.error("DB Connection Failed"); }
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    email: { type: String, default: 'Skipped' },
    twitter: { type: String, default: 'Skipped' },
    retweet: { type: String, default: 'Skipped' },
    linkedin: { type: String, default: 'Skipped' },
    facebook: { type: String, default: 'Skipped' },
    balance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    wallet: { type: String, default: null },
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const REF_BONUS = 5000;
const JOIN_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. সোশ্যাল টাস্ক সিস্টেম (Skip বাটন সহ) ---
const sendStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skip)]]));
};

bot.action('tasks', (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks (6,000 NXRA Total)</b>\n\nEarn 1,000 NXRA per task. Complete all to maximize your balance!`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\n\n👇 Send your Telegram Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\n\n👇 Send your Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Like & Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>This Post</a>\n\n👇 Send your Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\n\n👇 Send your LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\n\n👇 Send your Facebook URL:", 'finish_tasks'); });

// --- ৪. টাস্ক শেষ হওয়ার পর ফাইনাল মেসেজ ---
bot.action('finish_tasks', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;

        const finishMsg = `🎉 <b>Congratulations! You have finished all tasks.</b>\n\n` +
            `💰 <b>Task Rewards:</b> Successfully Processed\n` +
            `💵 <b>Total Balance:</b> ${user.balance} Nxracoin\n` +
            `👥 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n\n` +
            `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
            `📢 Share your link and earn <b>5000 NXRA</b> for every friend! 💸`;

        await ctx.replyWithHTML(finishMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (e) { ctx.reply("Error loading final stats."); }
});

// --- ৫. স্টার্ট কমান্ড (Join & Referral Reward) ---
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
                bot.telegram.sendMessage(inviterId, `🎁 <b>Referral Bonus!</b> Someone joined via your link. You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
                ctx.reply(`🎁 Welcome! You received ${JOIN_BONUS} NXRA bonus for joining!`);
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithHTML(`👋 <b>Welcome to Nxracoin Reward Bot!</b>`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'ref_system')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

// --- মেসেজ হ্যান্ডলার (Inputs & Step Rewards) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const steps = { 
        'ASK_EMAIL': { next: 'step_tg', field: 'email', msg: 'Email saved!' },
        'ASK_TG': { next: 'step_twitter', field: 'username', msg: 'Telegram tasks done!' },
        'ASK_TW': { next: 'step_retweet', field: 'twitter', msg: 'Twitter followed!' },
        'ASK_RT': { next: 'step_linkedin', field: 'retweet', msg: 'Post retweeted!' },
        'ASK_LI': { next: 'step_facebook', field: 'linkedin', msg: 'LinkedIn followed!' },
        'ASK_FB': { next: 'finish_tasks', field: 'facebook', msg: 'Facebook followed!' }
    };

    const currentStep = steps[user.actionState];
    if (currentStep) {
        let updateData = { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' };
        updateData[currentStep.field] = text;
        
        await User.findOneAndUpdate({ telegramId: userId }, updateData);
        ctx.replyWithHTML(`✅ <b>${currentStep.msg}</b>\n💰 +1000 NXRA rewarded!`, 
            Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Step', currentStep.next)]]));
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!", Markup.inlineKeyboard([[Markup.button.callback('🏦 Withdraw Menu', 'withdraw_menu')]]));
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `🚀 New Withdraw: ${amt} NXRA from @${user.username}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// --- রেফারেল ও অন্যান্য অ্যাকশন ---
bot.action('ref_system', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id }).lean();
        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const refMsg = `<b>👥 Nxracoin Invite & Earn</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n\n🔗 <b>Your Link:</b>\n${refLink}`;
        await ctx.replyWithHTML(refMsg, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'back_home')]]));
    } catch (e) { ctx.reply("Error."); }
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Added!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('back_home', (ctx) => ctx.reply("Menu: /start"));
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, referralCount: 0 });
    ctx.reply("✅ Reset Success!");
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

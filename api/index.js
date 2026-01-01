const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection Logic
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
    } catch (e) { console.error("DB Connection Failed"); }
};

// 2. Database Schema
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
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- Helper Functions for Tasks ---
const askEmail = (ctx) => ctx.replyWithHTML("📧 <b>Step 1:</b> Please send your <b>Email Address</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'step_tg')]]));
const askTG = (ctx) => ctx.replyWithHTML("📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\n\n👇 After joining, send your <b>Telegram Username</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'step_twitter')]]));
const askTwitter = (ctx) => ctx.replyWithHTML("🐦 <b>Step 3:</b> Follow our <a href='https://x.com/Nxracoin'>Twitter</a>\n\n👇 Send your <b>Twitter Username</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'step_retweet')]]));
const askRetweet = (ctx) => ctx.replyWithHTML("🔥 <b>Step 4:</b> Like & Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>This Post</a>\n\n👇 Send your <b>Retweet Link</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'step_linkedin')]]));
const askLinkedIn = (ctx) => ctx.replyWithHTML("💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\n\n👇 Send your <b>LinkedIn URL</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'step_facebook')]]));
const askFB = (ctx) => ctx.replyWithHTML("👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\n\n👇 Send your <b>Facebook URL</b>:", Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', 'finish_tasks')]]));

// --- 3. Bot Handlers ---
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
                ctx.replyWithHTML(`🎁 <b>Welcome!</b> You received <b>${JOIN_BONUS} NXRA</b> bonus for joining via referral!`);
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

// Task Actions
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{});
    ctx.replyWithHTML("<b>📋 Nxracoin Social Tasks</b> (6000 NXRA Total)\nEarn 1000 per task. Skip if needed.", 
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_EMAIL'}); askEmail(ctx); });
bot.action('step_tg', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_TG'}); askTG(ctx); });
bot.action('step_twitter', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_TW'}); askTwitter(ctx); });
bot.action('step_retweet', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_RT'}); askRetweet(ctx); });
bot.action('step_linkedin', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_LI'}); askLinkedIn(ctx); });
bot.action('step_facebook', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'ASK_FB'}); askFB(ctx); });
bot.action('finish_tasks', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({telegramId: ctx.from.id}, {actionState: 'IDLE'}); ctx.reply("🎉 Social tasks finished!"); });

// --- 4. Message Listener (Automated Step-by-Step) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    if (user.actionState === 'ASK_EMAIL') {
        await User.findOneAndUpdate({telegramId: userId}, { email: text, $inc: { balance: TASK_REWARD }, actionState: 'ASK_TG' });
        ctx.replyWithHTML("✅ Email saved! <b>+1000 NXRA</b>");
        return askTG(ctx);
    } else if (user.actionState === 'ASK_TG') {
        await User.findOneAndUpdate({telegramId: userId}, { $inc: { balance: TASK_REWARD }, actionState: 'ASK_TW' });
        ctx.replyWithHTML("✅ Telegram task done! <b>+1000 NXRA</b>");
        return askTwitter(ctx);
    } else if (user.actionState === 'ASK_TW') {
        await User.findOneAndUpdate({telegramId: userId}, { twitter: text, $inc: { balance: TASK_REWARD }, actionState: 'ASK_RT' });
        ctx.replyWithHTML("✅ Twitter saved! <b>+1000 NXRA</b>");
        return askRetweet(ctx);
    } else if (user.actionState === 'ASK_RT') {
        await User.findOneAndUpdate({telegramId: userId}, { retweet: text, $inc: { balance: TASK_REWARD }, actionState: 'ASK_LI' });
        ctx.replyWithHTML("✅ Retweet saved! <b>+1000 NXRA</b>");
        return askLinkedIn(ctx);
    } else if (user.actionState === 'ASK_LI') {
        await User.findOneAndUpdate({telegramId: userId}, { linkedin: text, $inc: { balance: TASK_REWARD }, actionState: 'ASK_FB' });
        ctx.replyWithHTML("✅ LinkedIn saved! <b>+1000 NXRA</b>");
        return askFB(ctx);
    } else if (user.actionState === 'ASK_FB') {
        await User.findOneAndUpdate({telegramId: userId}, { facebook: text, $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        return ctx.replyWithHTML("✅ Facebook saved! <b>+1000 NXRA</b>\n\n🎉 Congratulations! You have finished all tasks.");
    } 
    // Wallet & Withdraw Logic
    else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!", Markup.inlineKeyboard([[Markup.button.callback('🏦 Withdraw Menu', 'withdraw_menu')]]));
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdrawal: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// Referral Action
bot.action('ref_system', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id }).lean();
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    const refMsg = `<b>👥 Nxracoin Invite & Earn</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Referral: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n\n🔗 Your Link:\n${refLink}\n\n📢 Share & Earn with friends!`;
    ctx.replyWithHTML(refMsg, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'back_home')]]));
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('back_home', (ctx) => { ctx.answerCbQuery(); ctx.reply("Main Menu: Use /start"); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));
bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
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
            if (!user.lastMining || (Date.now() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: new Date() });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

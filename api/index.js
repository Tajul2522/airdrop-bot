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
            serverSelectionTimeoutMS: 5000
        });
    } catch (e) { console.error("DB Error"); }
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
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const REF_REWARD = 5000;
const JOIN_REWARD = 5000;

// --- ৩. সম্পূর্ণ নতুন রেফারেল লজিক (Trigger: open_ref_menu) ---
bot.action('open_ref_menu', async (ctx) => {
    // বাটন ক্লিক করার সাথে সাথে লোডিং থামানো
    await ctx.answerCbQuery().catch(() => {});
    
    try {
        await connectDB();
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId }).lean();
        
        if (!user) return ctx.reply("Please send /start first.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const totalRefCommission = (user.referralCount || 0) * REF_REWARD;

        const refMsg = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
            `🎁 *Join Bonus:* 5000 NXRA\n` +
            `💰 *Referral Reward:* 5000 NXRA\n\n` +
            `📊 *Total Referrals:* ${user.referralCount || 0} Users\n` +
            `💎 *Total Earned:* ${totalRefCommission} NXRA\n\n` +
            `🔗 *Your Unique Link:* \n${refLink}\n\n` +
            `📢 *Share this link!* Both you and your friend will receive *5000 NXRA* instantly! 💸`;

        await ctx.replyWithMarkdown(refMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (error) {
        await ctx.reply("❌ Connection unstable. Try again.");
    }
});

// --- ৪. সোশ্যাল টাস্ক (Skip বাটন সহ) ---
const sendTask = async (ctx, state, text, skipAction) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skipAction)]]));
};

bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.replyWithMarkdown(`📋 *Nxracoin Social Tasks* (6,000 NXRA Total)\n\nEarn 1,000 NXRA per task. Skip if you can't complete (No reward for skip).`, 
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_EMAIL', "📧 *Step 1:* Send your *Email Address*:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_TG', "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 Send TG Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_TW', "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 Send Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_RT', "🔥 *Step 4:* Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186)\n\n👇 Send Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_LI', "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3)\n\n👇 Send LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_FB', "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 Send Facebook URL:", 'finish_tasks'); });
bot.action('finish_tasks', (ctx) => { ctx.answerCbQuery(); ctx.reply("🎉 All tasks finished!"); });

// --- ৫. স্টার্ট কমান্ড (Double Reward Logic) ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            let inviter = (refId && Number(refId) !== userId) ? Number(refId) : null;
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: inviter ? JOIN_REWARD : 0, // নতুন ইউজার ৫০০০ পাবে
                referredBy: inviter
            });
            await user.save();

            if (inviter) {
                await User.findOneAndUpdate({ telegramId: inviter }, { $inc: { balance: REF_REWARD, referralCount: 1 } });
                bot.telegram.sendMessage(inviter, `🎁 *Referral Bonus!* Someone joined via your link. You earned 5000 NXRA!`).catch(()=>{});
            }
            if (inviter) ctx.reply(`🎁 Welcome! You received ${JOIN_REWARD} NXRA for joining via referral link!`);
        }

        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'open_ref_menu')], // নতুন আইডি
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

// --- মেসেজ হ্যান্ডলার (Rewards & Inputs) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const steps = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook', 'ASK_FB': 'finish_tasks' };
    
    if (steps[user.actionState]) {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: 1000 }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 NXRA added.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', steps[user.actionState])]]));
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!", Markup.inlineKeyboard([[Markup.button.callback('🏦 Back to Withdraw', 'withdraw_menu')]]));
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA | @${ctx.from.username} | Wallet: ${user.wallet}`);
            ctx.reply("✅ Request submitted!");
        } else ctx.reply("❌ Invalid amount.");
    }
});

// --- অন্যান্য একশন ---
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n💰 Balance: ${user.balance} NXRA\n${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('back_home', (ctx) => { ctx.answerCbQuery(); ctx.reply("Main Menu: Use /start"); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

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

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection Logic
let isConnected = false;
const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
    } catch (e) { console.error("DB Error"); }
};

// 2. Database Schema
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

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=21.0";
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- 3. Referral Option (Fixed & Fast) ---
bot.action('get_ref', async (ctx) => {
    try {
        await ctx.answerCbQuery().catch(() => {});
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id }).lean();
        if (!user) return ctx.reply("Please use /start first.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const totalEarned = (user.referralCount || 0) * REF_BONUS;

        const refMsg = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
            `🎁 *New User Bonus:* ${JOIN_BONUS} NXRA\n` +
            `💰 *Referral Reward:* ${REF_BONUS} NXRA\n\n` +
            `📊 *Your Total Referrals:* ${user.referralCount || 0} Users\n` +
            `💎 *Total Referral Earned:* ${totalEarned} NXRA\n\n` +
            `🔗 *Your Link:* \n${refLink}\n\n` +
            `📢 *Double Bonus:* Both you and your friend get 5000 NXRA! 💸`;

        await ctx.replyWithMarkdown(refMsg);
    } catch (e) { await ctx.reply("❌ Connection unstable. Try again."); }
});

// --- 4. Social Tasks with Skip Logic (No reward on Skip) ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    const msg = `📋 *Social Tasks* (6,000 NXRA Total)\n\nEarn 1,000 NXRA per task. If you skip, you will NOT receive rewards for that task.\n\n👇 Click below to start:`;
    ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

// Task Flow Handlers
const askStep = async (ctx, state, text, skipTo) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skipTo)]]));
};

bot.action('step_email', (ctx) => askStep(ctx, 'ASK_EMAIL', "📧 *Step 1:* Send your *Email Address*:", 'step_tg'));
bot.action('step_tg', (ctx) => askStep(ctx, 'ASK_TG', "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *Send your Telegram Username:*", 'step_tw'));
bot.action('step_tw', (ctx) => askStep(ctx, 'ASK_TW', "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 *Send your Twitter Username:*", 'step_rt'));
bot.action('step_rt', (ctx) => askStep(ctx, 'ASK_RT', "🔥 *Step 4:* Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186)\n\n👇 *Send your Retweet Link:*", 'step_li'));
bot.action('step_li', (ctx) => askStep(ctx, 'ASK_LI', "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?)\n\n👇 *Send LinkedIn URL:*", 'step_fb'));
bot.action('step_fb', (ctx) => askStep(ctx, 'ASK_FB', "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 *Send Facebook URL:*", 'finish_tasks'));

bot.action('finish_tasks', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    ctx.reply("🎉 All task steps finished!");
});

// --- 5. Message Listener (Input Rewards) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const rewardAndNext = async (msg, next) => {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ ${msg} +1000 NXRA!`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Step', next)]]));
    };

    if (user.actionState === 'ASK_EMAIL') await rewardAndNext("Email saved!", 'step_tg');
    else if (user.actionState === 'ASK_TG') await rewardAndNext("Telegram done!", 'step_tw');
    else if (user.actionState === 'ASK_TW') await rewardAndNext("Twitter saved!", 'step_rt');
    else if (user.actionState === 'ASK_RT') await rewardAndNext("Retweet link saved!", 'step_li');
    else if (user.actionState === 'ASK_LI') await rewardAndNext("LinkedIn saved!", 'step_fb');
    else if (user.actionState === 'ASK_FB') {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply("✅ Facebook saved! +1000 NXRA. Social tasks completed! 🎉");
    }
    // Wallet & Withdraw Handling
    else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: @${ctx.from.username} | ${amt} NXRA | ${user.wallet}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// --- 6. Core Commands ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let startBal = (refId && Number(refId) !== userId) ? JOIN_BONUS : 0;
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', balance: startBal, referredBy: (refId && Number(refId) !== userId) ? Number(refId) : null });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(user.referredBy, `🎁 Referral bonus! You earned ${REF_BONUS} NXRA.`).catch(e=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal*\n💰 *Balance:* ${user.balance} NXRA\n${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter amount to withdraw:");
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA Daily Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, referralCount: 0, actionState: 'IDLE' });
    ctx.reply("✅ Reset!");
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

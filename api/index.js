const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
    } catch (e) { console.error("DB Connection Failed"); }
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

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=20.0";
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- 3. Referral Info Logic (Fast & Stable) ---
bot.action('get_ref', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) return ctx.reply("Please send /start first.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const earned = (user.referralCount || 0) * REF_BONUS;

        const msg = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
                    `🎁 *Join Bonus:* 5000 NXRA\n` +
                    `💰 *Per Referral:* 5000 NXRA\n\n` +
                    `📊 *Total Invited:* ${user.referralCount || 0} Users\n` +
                    `💎 *Total Earned:* ${earned} NXRA\n\n` +
                    `🔗 *Your Referral Link:*\n${refLink}\n\n` +
                    `📢 Share this link with your friends! Both get 5000 NXRA!`;

        await ctx.replyWithMarkdown(msg);
    } catch (e) { await ctx.reply("System busy. Please try again."); }
});

// --- 4. Social Tasks with Reward/Skip Logic ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    const msg = `📋 *Nxracoin Social Tasks* (6,000 NXRA Total)\n\nComplete each task to earn 1,000 NXRA. If you skip a task, you won't get its reward.\n\nClick "Start Submitting" below:`;
    ctx.replyWithMarkdown(msg, Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

// Task Step Handlers
const startStep = async (ctx, state, text, skipAction) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skipAction)]]));
};

bot.action('step_email', (ctx) => startStep(ctx, 'ASK_EMAIL', "📧 *Step 1:* Please send your *Email Address*:", 'step_tg'));

bot.action('step_tg', (ctx) => {
    const msg = `📢 *Step 2:* Join our [Channel](https://t.me/+FfYvprJBYEMwYTJl) and [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *Send your Telegram Username:*`;
    return startStep(ctx, 'ASK_TG', msg, 'step_twitter');
});

bot.action('step_twitter', (ctx) => {
    const msg = `🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 *Send your Twitter Username:*`;
    return startStep(ctx, 'ASK_TW', msg, 'step_retweet');
});

bot.action('step_retweet', (ctx) => {
    const msg = `🔥 *Step 4:* Like, Comment & Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186?s=20)\n\n👇 *Send your Retweet Link:*`;
    return startStep(ctx, 'ASK_RT', msg, 'step_linkedin');
});

bot.action('step_linkedin', (ctx) => {
    const msg = `💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?)\n\n👇 *Send your LinkedIn Profile URL:*`;
    return startStep(ctx, 'ASK_LI', msg, 'step_facebook');
});

bot.action('step_facebook', (ctx) => {
    const msg = `👥 *Step 6:* Follow [Facebook Page](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 *Send your Facebook Profile URL:*`;
    return startStep(ctx, 'ASK_FB', msg, 'finish_tasks');
});

bot.action('finish_tasks', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    ctx.reply("🎉 Social task steps finished! Rewards added for completed tasks only.");
});

// --- 5. Message Listener (Input Handling with Rewards) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const rewardAndNext = async (msg, nextAction) => {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ ${msg} +1000 NXRA added!`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextAction)]]));
    };

    if (user.actionState === 'ASK_EMAIL') await rewardAndNext("Email saved!", "step_tg");
    else if (user.actionState === 'ASK_TG') await rewardAndNext("Telegram task done!", "step_twitter");
    else if (user.actionState === 'ASK_TW') await rewardAndNext("Twitter saved!", "step_retweet");
    else if (user.actionState === 'ASK_RT') await rewardAndNext("Retweet link saved!", "step_linkedin");
    else if (user.actionState === 'ASK_LI') await rewardAndNext("LinkedIn saved!", "step_facebook");
    else if (user.actionState === 'ASK_FB') {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply("✅ Facebook saved! +1000 NXRA. All tasks finished! 🎉");
    }
    // Wallet & Withdraw Amount Handling
    else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!", Markup.inlineKeyboard([[Markup.button.callback('🏦 Back to Withdraw', 'withdraw_menu')]]));
    }
    else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply(`✅ Request for ${amt} NXRA submitted!`);
        } else ctx.reply("❌ Invalid amount or insufficient balance.");
    }
});

// --- 6. Core Bot Commands ---
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
                bot.telegram.sendMessage(user.referredBy, `🎁 Referral bonus! You earned 5000 NXRA.`).catch(e=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n💰 *Balance:* ${user.balance} NXRA\n${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter amount to withdraw:");
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, referralCount: 0 });
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

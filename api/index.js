const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000
        });
    } catch (e) { console.error("DB Error"); }
};

// 2. Database Schema (Added taskBalance to track only social rewards)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    taskBalance: { type: Number, default: 0 }, // শুধু সোশ্যাল টাস্কের রিওয়ার্ড ট্র্যাক করার জন্য
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

// --- 3. Task Summary Function (Dynamic Reward Display) ---
const sendTaskSummary = async (ctx, user) => {
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const summaryMsg = `🎉 <b>Congratulations, ${username}!</b>\n\n` +
        `✅ <b>Tasks:</b> All successfully processed.\n` +
        `💰 <b>Task Rewards:</b> ${user.taskBalance} Nxracoin\n` + // এখানে ডাইনামিক ব্যালেন্স দেখাবে
        `💵 <b>Total Balance:</b> ${user.balance} Nxracoin\n\n` +
        `👥 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n` +
        `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
        `📢 <i>Invite friends and earn 5000 Nxracoin for every friend!</i>`;

    return ctx.replyWithHTML(summaryMsg, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'back_home')]]));
};

// --- 4. Task Flow ---
const askStep = async (ctx, state, text, skipAction) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skipAction)]]));
};

bot.action('tasks', (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks</b> (6,000 Nxracoin Total)\n\nEarn 1,000 per task. Reward is only added if you submit details. Skipped tasks earn 0 reward.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>Post</a>\nSend Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery().catch(()=>{}); return askStep(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\nSend Facebook URL:", 'finish_tasks'); });

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await connectDB();
    const user = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' }, { new: true });
    await sendTaskSummary(ctx, user);
});

// --- 5. Message Listener (Rewards for submissions only) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const nextStepMap = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook' };
    
    if (nextStepMap[user.actionState]) {
        const nextAction = nextStepMap[user.actionState];
        // এখানে balance এবং taskBalance দুটোই ১০০০ বাড়বে যেহেতু ইউজার তথ্য দিয়েছে
        const updatedUser = await User.findOneAndUpdate(
            { telegramId: userId }, 
            { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' }, 
            { new: true }
        );
        ctx.reply(`✅ Saved! +1000 Nxracoin added.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextAction)]]));
    } else if (user.actionState === 'ASK_FB') {
        const finalUser = await User.findOneAndUpdate(
            { telegramId: userId }, 
            { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' }, 
            { new: true }
        );
        await sendTaskSummary(ctx, finalUser);
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdrawal: @${ctx.from.username} | ${amt} Nxracoin | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount.");
    }
});

// --- 6. Other Commands (Mining, Bonus, Referral) ---
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
                balance: inviter ? JOIN_BONUS : 0,
                referredBy: inviter
            });
            await user.save();
            if (inviter) {
                await User.findOneAndUpdate({ telegramId: inviter }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> Someone joined via your link. You earned 5000 Nxracoin!`, {parse_mode: 'HTML'}).catch(()=>{});
                ctx.reply(`🎁 Welcome! You received ${JOIN_BONUS} Nxracoin bonus for joining!`);
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithHTML(`👋 <b>Welcome to Nxracoin Reward Bot!</b>`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 Referral Program</b>\n\n🎁 Join Bonus: 5000 Nxracoin\n💰 Per Ref: 5000 Nxracoin\n📊 Total Refs: ${user.referralCount || 0}\n\n🔗 <b>Your Link:</b>\n${refLink}`);
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal Dashboard</b>\n💰 Balance: ${user.balance} Nxracoin\n💳 Wallet: ${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 Nxracoin bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('back_home', (ctx) => { ctx.answerCbQuery().catch(()=>{}); ctx.reply("Main Menu: Use /start"); });
bot.action('support', (ctx) => { ctx.answerCbQuery().catch(()=>{}); ctx.reply("Support: @tajul15"); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, taskBalance: 0, referralCount: 0 });
    ctx.reply("✅ Data Reset!");
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

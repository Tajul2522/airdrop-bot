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
            useUnifiedTopology: true
        });
        console.log("MongoDB Connected");
    } catch (e) { console.error("Database Connection Failed"); }
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

// --- 3. Referral Logic (FIXED & REBUILT) ---
bot.action('get_ref', async (ctx) => {
    try {
        // বাটন লোডিং আইকন সাথে সাথে বন্ধ করা
        await ctx.answerCbQuery().catch(() => {});
        await connectDB();
        
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId });
        
        if (!user) return ctx.reply("❌ Data not found. Please send /start again.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const totalEarned = (user.referralCount || 0) * REF_BONUS;

        const refMsg = `👥 *Nxracoin Referral System* 👥\n\n` +
            `🎁 *Join Bonus:* ${JOIN_BONUS} NXRA\n` +
            `💰 *Referral Bonus:* ${REF_BONUS} NXRA\n\n` +
            `📊 *Total Invited:* ${user.referralCount || 0} Users\n` +
            `💎 *Total Earned:* ${totalEarned} NXRA\n\n` +
            `🔗 *Your Referral Link:* \n${refLink}\n\n` +
            `📢 Both you and your friend will get *5000 NXRA* when they join! 💸`;

        await ctx.replyWithMarkdown(refMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (error) {
        console.error("Referral Error:", error);
        await ctx.reply("❌ System busy. Please try /start again.");
    }
});

// --- 4. Main Menu & Start Command ---
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
                bot.telegram.sendMessage(user.referredBy, `🎁 *Referral Reward!* Someone joined using your link. You earned ${REF_BONUS} NXRA!`).catch(e=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        const welcomeText = `👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Mine daily, complete tasks, and invite friends to earn big!`;

        ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error(e); }
});

// --- 5. Social Tasks with Reward/Skip Logic ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.replyWithMarkdown(`📋 *Nxracoin Social Tasks* (6,000 NXRA)\n\nEarn 1,000 NXRA per task. Skipping a task results in no reward for that task.`, 
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting Details', 'step_email')]]));
});

const handleTask = async (ctx, state, text, skipAction) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skipAction)]]));
};

bot.action('step_email', (ctx) => handleTask(ctx, 'ASK_EMAIL', "📧 *Step 1:* Send your *Email Address*:", 'step_tg'));
bot.action('step_tg', (ctx) => handleTask(ctx, 'ASK_TG', "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *Send Telegram Username:*", 'step_tw'));
bot.action('step_tw', (ctx) => handleTask(ctx, 'ASK_TW', "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 *Send Twitter Username:*", 'step_rt'));
bot.action('step_rt', (ctx) => handleTask(ctx, 'ASK_RT', "🔥 *Step 4:* Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186?s=20)\n\n👇 *Send Retweet Link:*", 'step_li'));
bot.action('step_li', (ctx) => handleTask(ctx, 'ASK_LI', "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?)\n\n👇 *Send LinkedIn URL:*", 'step_fb'));
bot.action('step_fb', (ctx) => handleTask(ctx, 'ASK_FB', "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 *Send Facebook URL:*", 'finish_tasks'));

bot.action('finish_tasks', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("🎉 Tasks finished! Rewards added only for submitted details.");
});

// --- 6. Input Handling ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    const rewardFlow = async (msg, next) => {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ ${msg} +1000 NXRA added!`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next', next)]]));
    };

    if (user.actionState === 'ASK_EMAIL') await rewardFlow("Email saved!", "step_tg");
    else if (user.actionState === 'ASK_TG') await rewardFlow("Telegram saved!", "step_tw");
    else if (user.actionState === 'ASK_TW') await rewardFlow("Twitter saved!", "step_rt");
    else if (user.actionState === 'ASK_RT') await rewardFlow("Link saved!", "step_li");
    else if (user.actionState === 'ASK_LI') await rewardFlow("LinkedIn saved!", "step_fb");
    else if (user.actionState === 'ASK_FB') {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply("✅ Facebook saved! All tasks done! 💰");
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Request submitted!");
        } else ctx.reply("❌ Invalid amount.");
    }
});

// --- 7. Final Handlers ---
bot.action('back_home', (ctx) => ctx.reply("Main Menu: Use /start"));
bot.action('bonus', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA bonus claimed!");
    } else ctx.reply("❌ Tomorrow!");
});
bot.action('withdraw_menu', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Withdraw*\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: \`${user.wallet || 'Not Set'}\``, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});
bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' }); ctx.reply("Enter amount:"); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));
bot.command('reset', async (ctx) => { if (ctx.from.id === ADMIN_ID) { await connectDB(); await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, balance: 0, referralCount: 0 }); ctx.reply("✅ Reset!"); } });

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

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন লজিক
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
    } catch (e) { console.error("DB Connection Error"); }
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
const REF_BONUS = 5000;
const JOIN_BONUS = 5000;

// --- ৩. রেফারেল অপশন (সম্পূর্ণ ফিক্সড লজিক) ---
bot.action('get_ref', async (ctx) => {
    // বাটন ক্লিক করার সাথে সাথেই লোডিং বন্ধ করুন
    await ctx.answerCbQuery().catch(() => {});
    
    try {
        await connectDB();
        const userId = ctx.from.id;
        
        // শুধু প্রয়োজনীয় ডাটাটুকু ডাটাবেজ থেকে আনুন (দ্রুত হবে)
        const user = await User.findOne({ telegramId: userId }).select('referralCount').lean();
        
        if (!user) return ctx.reply("Please send /start first.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const earned = (user.referralCount || 0) * REF_BONUS;

        const refMsg = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
            `🎁 *Join Bonus:* 5000 NXRA\n` +
            `💰 *Per Referral:* 5000 NXRA\n\n` +
            `📊 *Total Invited:* ${user.referralCount || 0} Users\n` +
            `💎 *Total Earned:* ${earned} NXRA\n\n` +
            `🔗 *Your Referral Link:* \n${refLink}\n\n` +
            `📢 *Share your link! Both you and your friend will get 5000 NXRA each!* 💸`;

        await ctx.replyWithMarkdown(refMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (e) {
        console.error(e);
        await ctx.reply("❌ Connection unstable. Please try again.");
    }
});

// --- ৪. টাস্ক সিস্টেম (With Skip Button) ---
const sendTask = async (ctx, state, text, skipAction) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skipAction)]]));
};

bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    ctx.replyWithMarkdown(`📋 *Nxracoin Social Tasks* (6000 NXRA Total)\n\nEarn 1000 NXRA per task. Skip any task you can't do (0 reward for skip).`, 
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_EMAIL', "📧 *Step 1:* Send your *Email Address*:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_TG', "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 Send TG Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_TW', "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 Send Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_RT', "🔥 *Step 4:* Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186)\n\n👇 Send Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_LI', "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3)\n\n👇 Send LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery().catch(() => {}); return sendTask(ctx, 'ASK_FB', "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 Send Facebook URL:", 'finish_tasks'); });
bot.action('finish_tasks', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply("🎉 Social tasks finished!"); });

// --- ৫. মেসেজ হ্যান্ডলার ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const nextStep = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook', 'ASK_FB': 'finish_tasks' };
    
    if (nextStep[user.actionState]) {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: 1000 }, actionState: 'IDLE' });
        ctx.reply(`✅ Saved! +1000 NXRA Added.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextStep[user.actionState])]]));
    } else if (user.actionState === 'AWAIT_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAIT_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// --- ৬. মেইন মেনু ---
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
                bot.telegram.sendMessage(inviter, `🎁 *Referral Bonus!* You earned 5000 NXRA!`).catch(e=>{});
            }
        }
        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support_msg')]
        ]));
    } catch (e) { console.error(e); }
});

bot.action('back_home', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply("Returning to menu... /start"); });
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: \`${user.wallet || 'Not Set'}\``, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAIT_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAIT_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Added!");
    } else ctx.reply("❌ Claim tomorrow!");
});
bot.action('support_msg', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply("Support: @tajul15"); });

// --- ভার্সেল হ্যান্ডলার ---
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

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

// --- ৩. রেফারেল অপশন (HTML Format ব্যবহার করা হয়েছে যাতে Error না হয়) ---
bot.action('ref_system', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id }).lean();
        if (!user) return ctx.reply("Please send /start first.");

        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const totalCommission = (user.referralCount || 0) * REF_BONUS;

        const refMsg = `<b>👥 Nxracoin Invite & Earn</b>\n\n` +
            `🎁 <b>Join Bonus:</b> 5000 NXRA\n` +
            `💰 <b>Per Referral:</b> 5000 NXRA\n\n` +
            `📊 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n` +
            `💎 <b>Total Earned:</b> ${totalCommission} NXRA\n\n` +
            `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
            `📢 <b>Share & Earn:</b> You and your friend both will get <b>5000 NXRA</b> instantly! 💸`;

        // replyWithHTML ব্যবহার করা হয়েছে এরর এড়াতে
        await ctx.replyWithHTML(refMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));
    } catch (err) {
        console.error("Referral Error:", err);
        await ctx.reply("❌ Connection unstable. Please try /start again.");
    }
});

// --- ৪. সোশ্যাল টাস্ক সিস্টেম (Skip বাটন সহ) ---
const sendStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skip)]]));
};

bot.action('tasks', (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks (6,000 NXRA)</b>\n\nEarn 1,000 per task. Skip any task you cannot do.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Now', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return sendStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>This Post</a>\nSend Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return sendTask(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\nSend Facebook URL:", 'finish_tasks'); });
bot.action('finish_tasks', (ctx) => { ctx.answerCbQuery(); ctx.reply("🎉 All tasks finished!"); });

// --- ৫. স্টার্ট কমান্ড (Double Reward Logic) ---
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
                ctx.reply(`🎁 Welcome! You received ${JOIN_BONUS} NXRA bonus!`);
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

// --- মেসেজ হ্যান্ডলার ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const steps = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook', 'ASK_FB': 'finish_tasks' };
    
    if (steps[user.actionState]) {
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: 1000 }, actionState: 'IDLE' });
        ctx.reply(`✅ +1000 NXRA Added!`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', steps[user.actionState])]]));
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid amount or insufficient balance.");
    }
});

// --- অন্যান্য ---
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal Dashboard</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount to Withdraw:"); });
bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Added!");
    } else ctx.reply("❌ Claim tomorrow!");
});
bot.action('back_home', (ctx) => ctx.reply("Main Menu: Use /start"));
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

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন লজিক
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Database Connected Successfully");
    } catch (e) { 
        console.error("Database Connection Failed"); 
    }
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
const TASK_REWARD = 1000;

// সামারি মেসেজ ফাংশন
const sendSummary = async (ctx, user) => {
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const name = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const text = `🎉 <b>Congratulations, ${name}!</b>\n\n` +
        `✅ <b>Tasks:</b> All successfully processed.\n` +
        `💰 <b>Task Rewards:</b> 6000 NXRA\n` +
        `💵 <b>Total Balance:</b> ${user.balance} NXRA\n\n` +
        `👥 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n` +
        `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
        `📢 <i>Invite friends and earn 5000 NXRA for every friend!</i>`;

    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'back_home')]]));
};

// --- ৩. টাস্ক কন্ট্রোল ---
const askTask = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skip)]]));
};

bot.action('tasks', (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks</b>\n\nEarn 1,000 NXRA per task. Skip if needed.\n\nClick below to start:`, 
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG Username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Twitter Username:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>This Post</a>\nSend Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend Profile Link:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return askTask(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\nSend Profile Link:", 'finish_tasks'); });

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await connectDB();
    const user = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' }, { new: true });
    await sendSummary(ctx, user);
});

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
                bot.telegram.sendMessage(inviterId, `🎁 <b>Referral Bonus!</b> You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
                ctx.reply(`🎁 Welcome! You received ${JOIN_BONUS} NXRA bonus!`);
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

// --- ৫. মেসেজ লিসেনার ---
bot.on('text', async (ctx) => {
    await connectDB();
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const steps = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook' };
    
    if (steps[user.actionState]) {
        const updated = await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' }, { new: true });
        ctx.reply(`✅ Saved! +1000 NXRA added.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', steps[user.actionState])]]));
    } else if (user.actionState === 'ASK_FB') {
        const finalUser = await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: TASK_REWARD }, actionState: 'IDLE' }, { new: true });
        await sendSummary(ctx, finalUser);
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount or insufficient balance.");
    }
});

// অন্যান্য বাটনসমূহ
bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 Referral Program</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n\n🔗 <b>Your Link:</b> \n${refLink}`);
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{}); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: <code>${user.wallet || 'Not Set'}</code>`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')],
        [Markup.button.callback('⬅️ Back', 'back_home')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await ctx.answerCbQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('back_home', (ctx) => { ctx.answerCbQuery(); ctx.reply("Use /start to see menu."); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, referralCount: 0 });
    ctx.reply("✅ Reset Success!");
});

// --- ৪. ভার্সেল হ্যান্ডলার ---
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

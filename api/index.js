const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    } catch (e) { console.error("DB Error"); }
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    taskBalance: { type: Number, default: 0 },
    pendingTaskReward: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    wallet: { type: String, default: null },
    actionState: { type: String, default: 'IDLE' },
    allTasksFinished: { type: Boolean, default: false },
    email: String, twitter: String, retweet: String, linkedin: String, facebook: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. টাস্ক সামারি ফাংশন (Congratulations Message Update) ---
const sendTaskSummary = async (ctx, user) => {
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const name = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const summaryMsg = `🎉 <b>Congratulations, ${name}!</b>\n\n` +
        `✅ <b>Tasks:</b> All successfully processed.\n` +
        `💰 <b>Task Rewards:</b> ${user.taskBalance} NXRA\n` +
        `💵 <b>Total Balance:</b> ${user.balance} NXRA\n\n` +
        `👥 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n` +
        `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
        `📢 <i>Invite friends and earn 5000 NXRA for every friend! Both you and your friend will get bonus!</i>`;

    return ctx.replyWithHTML(summaryMsg, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'back_home')]]));
};

// --- ৪. সিকিউরিটি ভ্যালিডেশন ---
const isValidEmail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
const isValidTwitter = (t) => t.includes('x.com/') || t.includes('twitter.com/');
const isValidRetweet = (t) => (t.includes('x.com/') || t.includes('twitter.com/')) && t.includes('/status/');
const isValidLI = (t) => t.includes('linkedin.com/');
const isValidFB = (t) => t.includes('facebook.com/');

// টাস্ক ধাপ হ্যান্ডলার
const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skip)]]));
};

// --- ৫. মেইন মেনু কিবোর্ড (Reply Keyboard) ---
const mainMenu = Markup.keyboard([
    ['⛏️ Start Daily Mining'],
    ['📝 Social Tasks', '🎁 Daily Bonus'],
    ['🏦 Withdraw', '👥 Referral'],
    ['☎️ Support']
]).resize();

// --- ৬. বটের কমান্ড ও বাটন লজিক ---

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
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> Someone joined via your link. You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
            if (inviter) ctx.reply(`🎁 Welcome! You received 5000 NXRA bonus for joining via referral!`);
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithHTML(`👋 <b>Welcome to NXRA Reward Bot!</b>`, mainMenu);
    } catch (e) { console.error(e); }
});

bot.hears('⛏️ Start Daily Mining', (ctx) => ctx.replyWithMarkdown(`🚀 *Open NXRA App* to mine:`, Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]])));

bot.hears('📝 Social Tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user && user.allTasksFinished) return ctx.replyWithHTML("✅ <b>Tasks already completed!</b>");
    
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { pendingTaskReward: 0 });
    ctx.replyWithHTML(`<b>📋 NXRA Social Tasks (6,000 Total)</b>\nEarn 1,000 NXRA per task. Submit real details to get rewards.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

// টাস্ক ধাপসমূহ
bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TG', "📢 <b>Step 2 & 3:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG @username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TW', "🐦 <b>Step 4:</b> Follow <a href='https://x.com/Nxracoin'>Twitter Profile</a>\nSend Twitter Link:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_RT', "🔥 <b>Step 5:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>This Post</a>\nSend Retweet Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_LI', "💼 <b>Step 6:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn Profile</a>\nSend LinkedIn URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_FB', "👥 <b>Step 7:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>\nSend Facebook URL:", 'finish_tasks'); });

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const total = user.pendingTaskReward;
    const up = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: total, taskBalance: total }, pendingTaskReward: 0, allTasksFinished: true, actionState: 'IDLE' }, {new: true});
    await sendTaskSummary(ctx, up);
});

// --- ৭. মেসেজ লিসেনার (Validation & Logic) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const menuButtons = ['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'];
    if (text.startsWith('/') || menuButtons.includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const rewardAndNext = async (field, next) => {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { [field]: text, $inc: { pendingTaskReward: 1000 }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 NXRA pending.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', next)]]));
    };

    const st = user.actionState;
    if (st === 'ASK_EMAIL' && isValidEmail(text)) await rewardAndNext('email', 'step_tg');
    else if (st === 'ASK_TG' && text.startsWith('@')) await rewardAndNext('username', 'step_twitter');
    else if (st === 'ASK_TW' && isValidTwitter(text)) await rewardAndNext('twitter', 'step_retweet');
    else if (st === 'ASK_RT' && isValidRetweet(text)) await rewardAndNext('retweet', 'step_linkedin');
    else if (st === 'ASK_LI' && isValidLI(text)) await rewardAndNext('linkedin', 'step_facebook');
    else if (st === 'ASK_FB' && isValidFB(text)) {
        const finalUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { facebook: text, $inc: { pendingTaskReward: 1000 }, actionState: 'IDLE', allTasksFinished: true }, {new: true});
        const total = finalUser.pendingTaskReward;
        const up = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: total, taskBalance: total }, pendingTaskReward: 0 }, {new: true});
        await sendTaskSummary(ctx, up);
    } else if (st === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (st === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount.");
    } else {
        ctx.reply("⚠️ Invalid! Please enter correct information to earn reward.");
    }
});

// --- ৮. অন্যান্য একশন ---
bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.hears('👥 Referral', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 NXRA Referral Program</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}`);
});

bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.hears('☎️ Support', (ctx) => ctx.reply("Support Admin: @tajul15"));
bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter NXRA amount:"); });
bot.action('back_home', (ctx) => { ctx.answerCbQuery().catch(()=>{}); ctx.reply("Main Menu updated."); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, taskBalance: 0, pendingTaskReward: 0, referralCount: 0, allTasksFinished: false });
    ctx.reply("✅ Data Reset Successful!");
});

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

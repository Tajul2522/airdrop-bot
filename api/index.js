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

// --- ৩. মেইন মেনু বাটন (একদম হুবহু আপনার স্ক্রিনশটের মতো) ---
const mainMenu = Markup.keyboard([
    ['⛏️ Start Daily Mining'],
    ['📝 Social Tasks', '🎁 Daily Bonus'],
    ['🏦 Withdraw', '👥 Referral'],
    ['☎️ Support']
]).resize();

// --- ৪. সিকিউরিটি চেক লজিক ---
const isValidEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
const isValidURL = (text, platform) => text.toLowerCase().includes(`${platform}.com/`);
const isValidRetweet = (text) => (text.includes('x.com/') || text.includes('twitter.com/')) && text.includes('/status/');

const sendTaskSummary = async (ctx, user) => {
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const summaryMsg = `🎉 <b>Congratulations!</b>\n\n✅ <b>Tasks:</b> Submitted for verification.\n💰 <b>Task Rewards:</b> ${user.taskBalance} NXRA\n💵 <b>Total Balance:</b> ${user.balance} NXRA\n\n👥 <b>Total Referrals:</b> ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}\n\n⚠️ <i>Manual verification is active. Fake links = Ban!</i>`;
    return ctx.replyWithHTML(summaryMsg, mainMenu);
};

// --- ৫. কমান্ড ও বাটন হ্যান্ডলিং ---

bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;
        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            let inviter = (refId && Number(refId) !== userId) ? Number(refId) : null;
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', balance: inviter ? JOIN_BONUS : 0, referredBy: inviter });
            await user.save();
            if (inviter) {
                await User.findOneAndUpdate({ telegramId: inviter }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithHTML(`👋 <b>Welcome to NXRA Reward Bot!</b>`, mainMenu);
    } catch (e) { console.error(e); }
});

bot.hears('⛏️ Start Daily Mining', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    ctx.replyWithMarkdown(`🚀 *Open App* to start mining NXRA:`, Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]]));
});

bot.hears('📝 Social Tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user && user.allTasksFinished) return ctx.replyWithHTML("✅ <b>Tasks already completed!</b>");
    
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    ctx.replyWithHTML(`<b>📋 NXRA Social Tasks</b>\nEarn 1,000 NXRA per task. Submit real info!`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA Daily Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.hears('👥 Referral', async (ctx) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 Referral Program</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}`);
});

bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.hears('☎️ Support', (ctx) => ctx.reply("Support: @tajul15"));

// --- ৬. সোশ্যাল টাস্ক ফ্লো (Callbacks) ---
const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skip)]]));
};

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 Send your Email:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TG', "📢 Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend @username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TW', "🐦 Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Profile URL:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_RT', "🔥 Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>Post</a>\nSend Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_LI', "💼 Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_FB', "👥 Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook</a>\nSend URL:", 'finish_tasks'); });

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE', allTasksFinished: true }, { new: true });
    await sendTaskSummary(ctx, user);
});

// --- ৭. মেসেজ লিসেনার (Validation & Logic) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;
    
    // কিবোর্ড বাটনগুলো হলে কোনো প্রসেস হবে না (এটি বাটন ফিক্স করবে)
    const menuButtons = ['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'];
    if (menuButtons.includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const reward = async (field, next) => {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { [field]: text, $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 NXRA.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', next)]]));
    };

    const st = user.actionState;
    if (st === 'ASK_EMAIL' && isValidEmail(text)) await reward('email', 'step_tg');
    else if (st === 'ASK_TG' && text.startsWith('@')) await reward('username', 'step_twitter');
    else if (st === 'ASK_TW' && isValidURL(text, 'x')) await reward('twitter', 'step_retweet');
    else if (st === 'ASK_RT' && isValidRetweet(text)) await reward('retweet', 'step_linkedin');
    else if (st === 'ASK_LI' && isValidURL(text, 'linkedin')) await reward('linkedin', 'step_facebook');
    else if (st === 'ASK_FB' && isValidURL(text, 'facebook')) {
        const up = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { facebook: text, $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE', allTasksFinished: true }, {new: true});
        await sendTaskSummary(ctx, up);
    } else if (st === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (st === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `🚀 New Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal submitted successfully!");
        } else ctx.reply("❌ Invalid amount or insufficient balance.");
    } else {
        ctx.reply("⚠️ Invalid format! Please send a real link or @username.");
    }
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter NXRA amount:"); });

// --- Vercel Handler ---
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

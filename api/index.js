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
    allTasksFinished: { type: Boolean, default: false }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. মেইন মেনু বাটন (Reply Keyboard) ---
const mainMenu = Markup.keyboard([
    ['⛏️ Start Daily Mining'],
    ['📝 Social Tasks', '🎁 Daily Bonus'],
    ['🏦 Withdraw', '👥 Referral'],
    ['☎️ Support']
]).resize();

// --- ৪. সিকিউরিটি ভ্যালিডেশন ফাংশন ---
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

// --- ৫. বটের মেইন কমান্ড ও বাটন লজিক (bot.hears অগ্রাধিকার পাবে) ---

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
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
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
    ctx.replyWithHTML(`<b>📋 NXRA Social Tasks (6,000 NXRA)</b>\n\nEarn 1,000 NXRA per task. Complete all to get rewards. Skip = No Reward.\n\n👇 Click below to start:`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.hears('👥 Referral', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 NXRA Referral</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}`);
});

bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal Dashboard</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.hears('☎️ Support', (ctx) => ctx.reply("Support: @tajul15"));

// --- ৬. সোশ্যাল টাস্ক ফ্লো (সব লিঙ্ক সহ) ---

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });

bot.action('step_tg', (ctx) => {
    ctx.answerCbQuery();
    const msg = `📢 <b>Step 2 & 3:</b> Join our Community:\n\n1. <a href='https://t.me/+FfYvprJBYEMwYTJl'>Telegram Channel</a>\n2. <a href='https://t.me/+jPnGAXqmb-liYzM1'>Telegram Group</a>\n\n👇 <b>Send your TG @username:</b>`;
    return askStep(ctx, 'ASK_TG', msg, 'step_twitter');
});

bot.action('step_twitter', (ctx) => {
    ctx.answerCbQuery();
    const msg = `🐦 <b>Step 4:</b> Follow our <a href='https://x.com/Nxracoin'>Twitter Profile</a>.\n\n👇 <b>Send your Twitter Profile Link:</b>`;
    return askStep(ctx, 'ASK_TW', msg, 'step_retweet');
});

bot.action('step_retweet', (ctx) => {
    ctx.answerCbQuery();
    const msg = `🔥 <b>Step 5:</b> Like, Comment & Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186?s=20'>This Post</a>.\n\n👇 <b>Send your Retweet Post Link:</b>`;
    return askStep(ctx, 'ASK_RT', msg, 'step_linkedin');
});

bot.action('step_linkedin', (ctx) => {
    ctx.answerCbQuery();
    const msg = `💼 <b>Step 6:</b> Follow our <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3?'>LinkedIn Profile</a>.\n\n👇 <b>Send your LinkedIn URL:</b>`;
    return askStep(ctx, 'ASK_LI', msg, 'step_facebook');
});

bot.action('step_facebook', (ctx) => {
    ctx.answerCbQuery();
    const msg = `👥 <b>Step 7:</b> Follow our <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>.\n\n👇 <b>Send your Facebook Profile URL:</b>`;
    return askStep(ctx, 'ASK_FB', msg, 'finish_tasks');
});

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    // ব্যালেন্স যোগ করার লজিক
    const total = user.pendingTaskReward;
    const up = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: total, taskBalance: total }, pendingTaskReward: 0, allTasksFinished: true, actionState: 'IDLE' }, {new: true});
    
    ctx.replyWithHTML(`🎉 <b>Congratulations!</b>\n\n💰 Task Reward: ${total} NXRA\n💵 Total Balance: ${up.balance} NXRA\n🔗 Ref Link: https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`);
});

// --- ৭. টেক্সট মেসেজ লিসেনার (সিকিউরিটি সহ) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const menuButtons = ['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'];
    if (text.startsWith('/') || menuButtons.includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const rewardAndNext = async (next) => {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { pendingTaskReward: 1000 }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 NXRA pending.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', next)]]));
    };

    const st = user.actionState;
    if (st === 'ASK_EMAIL' && isValidEmail(text)) await rewardAndNext('step_tg');
    else if (st === 'ASK_TG' && text.startsWith('@')) await rewardAndNext('step_twitter');
    else if (st === 'ASK_TW' && isValidTwitter(text)) await rewardAndNext('step_retweet');
    else if (st === 'ASK_RT' && isValidRetweet(text)) await rewardAndNext('step_linkedin');
    else if (st === 'ASK_LI' && isValidLI(text)) await rewardAndNext('step_facebook');
    else if (st === 'ASK_FB' && isValidFB(text)) {
        const finalUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { pendingTaskReward: 1000 }, actionState: 'IDLE', allTasksFinished: true }, {new: true});
        const total = finalUser.pendingTaskReward;
        const up = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: total, taskBalance: total }, pendingTaskReward: 0 }, {new: true});
        ctx.replyWithHTML(`🎉 <b>Congratulations!</b>\n💰 Reward: ${total} NXRA\n💵 Total Balance: ${up.balance} NXRA`);
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
        ctx.reply("⚠️ Invalid! Enter correct details to earn reward.");
    }
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter amount:"); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, taskBalance: 0, pendingTaskReward: 0, referralCount: 0, allTasksFinished: false });
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

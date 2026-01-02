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

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=22.0`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. সিকিউরিটি ভ্যালিডেশন ফাংশন (Regex) ---
const isValidEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
const isValidTwitter = (text) => text.includes('x.com/') || text.includes('twitter.com/');
const isValidRetweet = (text) => (text.includes('x.com/') || text.includes('twitter.com/')) && text.includes('/status/');
const isValidLinkedIn = (text) => text.includes('linkedin.com/');
const isValidFacebook = (text) => text.includes('facebook.com/');

// --- ৪. টাস্ক সামারি (Final Summary) ---
const sendTaskSummary = async (ctx, user) => {
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const summaryMsg = `🎉 <b>Congratulations, ${username}!</b>\n\n` +
        `✅ <b>Tasks:</b> All processed successfully.\n` +
        `💰 <b>Task Rewards:</b> ${user.taskBalance} NXRA\n` +
        `💵 <b>Total Balance:</b> ${user.balance} NXRA\n\n` +
        `👥 <b>Total Referrals:</b> ${user.referralCount || 0} Users\n` +
        `🔗 <b>Your Referral Link:</b>\n${refLink}\n\n` +
        `⚠️ <b>Note:</b> We will verify details manually. Fake info will result in a ban! 🚫`;

    return ctx.replyWithHTML(summaryMsg);
};

// --- ৫. সোশ্যাল টাস্ক ফ্লো (আপনার দেওয়া লিঙ্ক সহ) ---
const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skip)]]));
};

bot.hears('📝 Social Tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user && user.allTasksFinished) return ctx.replyWithHTML("✅ <b>Tasks already completed!</b>");
    
    ctx.replyWithHTML(`<b>📋 NXRA Social Tasks (6,000 Total)</b>\n\nSubmit your real details step-by-step. Skipped tasks get 0 reward.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'); });

bot.action('step_tg', (ctx) => {
    ctx.answerCbQuery();
    const msg = `📢 <b>Step 2 & 3:</b> Join our Community:\n\n1. <a href='https://t.me/+FfYvprJBYEMwYTJl'>Telegram Channel</a>\n2. <a href='https://t.me/+jPnGAXqmb-liYzM1'>Telegram Group</a>\n\n👇 <b>Send your Telegram @username:</b>`;
    return askStep(ctx, 'ASK_TG', msg, 'step_twitter');
});

bot.action('step_twitter', (ctx) => {
    ctx.answerCbQuery();
    const msg = `🐦 <b>Step 4:</b> Follow our <a href='https://x.com/Nxracoin'>Twitter Profile</a>.\n\n👇 <b>Send your Twitter Profile Link:</b>`;
    return askStep(ctx, 'ASK_TW', msg, 'step_retweet');
});

bot.action('step_retweet', (ctx) => {
    ctx.answerCbQuery();
    const msg = `🔥 <b>Step 5:</b> Like, Comment & Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186?s=20'>This Post</a>.\n\n👇 <b>Send your Retweet Link:</b>`;
    return askStep(ctx, 'ASK_RT', msg, 'step_linkedin');
});

bot.action('step_linkedin', (ctx) => {
    ctx.answerCbQuery();
    const msg = `💼 <b>Step 6:</b> Follow our <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3?'>LinkedIn Profile</a>.\n\n👇 <b>Send your LinkedIn Profile URL:</b>`;
    return askStep(ctx, 'ASK_LI', msg, 'step_facebook');
});

bot.action('step_facebook', (ctx) => {
    ctx.answerCbQuery();
    const msg = `👥 <b>Step 7:</b> Follow our <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook Page</a>.\n\n👇 <b>Send your Facebook Profile URL:</b>`;
    return askStep(ctx, 'ASK_FB', msg, 'finish_tasks');
});

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE', allTasksFinished: true }, { new: true });
    await sendTaskSummary(ctx, user);
});

// --- ৬. মেসেজ লিসেনার (সিকিউরিটি ভ্যালিডেশন সহ) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    if (['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'].includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const rewardAndNext = async (field, nextAction) => {
        const upUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { [field]: text, $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' }, {new: true});
        ctx.reply(`✅ Detail Saved! +1000 NXRA.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextAction)]]));
    };

    const st = user.actionState;
    if (st === 'ASK_EMAIL') {
        if (isValidEmail(text)) await rewardAndNext('email', 'step_tg');
        else ctx.reply("❌ Invalid Email! Please send a valid email address.");
    } else if (st === 'ASK_TG') {
        if (text.startsWith('@')) await rewardAndNext('username', 'step_twitter');
        else ctx.reply("❌ Invalid! Send your Telegram username starting with @");
    } else if (st === 'ASK_TW') {
        if (isValidTwitter(text)) await rewardAndNext('twitter', 'step_retweet');
        else ctx.reply("❌ Invalid Link! Send your Twitter profile URL.");
    } else if (st === 'ASK_RT') {
        if (isValidRetweet(text)) await rewardAndNext('retweet', 'step_linkedin');
        else ctx.reply("❌ Invalid Retweet Link! Send the specific post status link.");
    } else if (st === 'ASK_LI') {
        if (isValidLinkedIn(text)) await rewardAndNext('linkedin', 'step_facebook');
        else ctx.reply("❌ Invalid Link! Send your LinkedIn profile URL.");
    } else if (st === 'ASK_FB') {
        if (isValidFacebook(text)) {
            const finalUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { facebook: text, $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE', allTasksFinished: true }, {new: true});
            await sendTaskSummary(ctx, finalUser);
        } else ctx.reply("❌ Invalid Link! Send your Facebook profile URL.");
    } else if (st === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (st === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount.");
    }
});

// --- ৭. মেইন কমান্ড ও মেনু বাটন ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let inviter = (refId && Number(refId) !== userId) ? Number(refId) : null;
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', balance: inviter ? 5000 : 0, referredBy: inviter });
            await user.save();
            if (inviter) {
                await User.findOneAndUpdate({ telegramId: inviter }, { $inc: { balance: 5000, referralCount: 1 } });
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithHTML(`👋 <b>Welcome to NXRA Reward Bot!</b>`, Markup.keyboard([['⛏️ Start Daily Mining'],['📝 Social Tasks', '🎁 Daily Bonus'],['🏦 Withdraw', '👥 Referral'],['☎️ Support']]).resize());
    } catch (e) { console.error(e); }
});

bot.hears('⛏️ Start Daily Mining', (ctx) => ctx.replyWithMarkdown(`🚀 *Open App* to mine:`, Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]])));
bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA bonus added!");
    } else ctx.reply("❌ Claim tomorrow!");
});
bot.hears('👥 Referral', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`👥 <b>NXRA Referral</b>\n\n🎁 Join Bonus: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Link:</b>\n${refLink}`);
});
bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithHTML(`🏦 <b>Withdraw</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${user.wallet || 'Not Set'}`, Markup.inlineKeyboard([[!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],[Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]]));
});
bot.hears('☎️ Support', (ctx) => ctx.reply("Support: @tajul15"));

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter amount to withdraw:"); });

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

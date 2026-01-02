const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// 1. Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    } catch (e) { console.error("DB Error"); }
};

// 2. Database Schema
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
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

mongoose.connect(process.env.MONGO_URI);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- ৩. মেইন মেনু কিবোর্ড (স্ক্রিনের নিচে স্থায়ী থাকবে) ---
const mainMenu = Markup.keyboard([
    ['⛏️ Start Daily Mining'], // একদম উপরে মাঝখানে
    ['📝 Social Tasks', '🎁 Daily Bonus'], // বামে ও ডানে
    ['🏦 Withdraw', '👥 Referral'], // বামে ও ডানে
    ['☎️ Support'] // নিচে মাঝখানে
]).resize(); // resize() দিলে বাটনগুলো মোবাইলে দেখতে সুন্দর লাগে

// --- ৪. স্টার্ট কমান্ড (Double Reward) ---
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
                bot.telegram.sendMessage(inviterId, `🎁 <b>Referral Bonus!</b> Someone joined via your link. You earned 5000 Nxracoin!`, {parse_mode: 'HTML'}).catch(()=>{});
                ctx.reply(`🎁 Welcome! You received ${JOIN_BONUS} Nxracoin bonus!`);
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithHTML(`👋 <b>Welcome to Nxracoin Reward Bot!</b>\n\n🚀 Use the menu below to earn Nxracoin daily!`, mainMenu);
    } catch (e) { console.error(e); }
});

// --- ৫. কিবোর্ড বাটন হ্যান্ডলিং (bot.hears ব্যবহার করে) ---

bot.hears('⛏️ Start Daily Mining', (ctx) => {
    ctx.replyWithMarkdown(`🚀 *Open Nxracoin App* to start mining:`, 
        Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]])
    );
});

bot.hears('👥 Referral', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id }).lean();
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    const totalEarned = (user.referralCount || 0) * REF_BONUS;
    const refMsg = `👥 <b>Nxracoin Referral</b>\n\n🎁 Join Bonus: 5000 Nxracoin\n💰 Per Ref: 5000 Nxracoin\n📊 Total Refs: ${user.referralCount || 0}\n💎 Total Earned: ${totalCommission = totalEarned} Nxracoin\n\n🔗 <b>Your Link:</b>\n${refLink}`;
    ctx.replyWithHTML(refMsg);
});

bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 Nxracoin bonus added to your balance!");
    } else ctx.reply("❌ Already claimed! Come back tomorrow.");
});

bot.hears('📝 Social Tasks', (ctx) => {
    ctx.replyWithHTML(`<b>📋 Nxracoin Social Tasks</b> (6,000 Total)\nEarn 1,000 per task. Reward for real details only.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdrawal</b>\n💰 Balance: ${user.balance} Nxracoin\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.hears('☎️ Support', (ctx) => ctx.reply("Support Admin: @tajul15"));

// --- ৬. সোশ্যাল টাস্ক ফ্লো (Inline Callbacks) ---
const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip Task', skip)]]));
};

bot.action('step_email', (ctx) => askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send your <b>Email Address</b>:", 'step_tg'));
bot.action('step_tg', (ctx) => askStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join <a href='https://t.me/+FfYvprJBYEMwYTJl'>Channel</a> & <a href='https://t.me/+jPnGAXqmb-liYzM1'>Group</a>\nSend TG Username:", 'step_twitter'));
bot.action('step_twitter', (ctx) => askStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow <a href='https://x.com/Nxracoin'>Twitter</a>\nSend Twitter URL:", 'step_retweet'));
bot.action('step_retweet', (ctx) => askStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet <a href='https://x.com/Nxracoin/status/2006308628375245186'>Post</a>\nSend Link:", 'step_linkedin'));
bot.action('step_linkedin', (ctx) => askStep(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow <a href='https://www.linkedin.com/in/nxracoin-mining-186ba23a3'>LinkedIn</a>\nSend URL:", 'step_facebook'));
bot.action('step_facebook', (ctx) => askStep(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow <a href='https://www.facebook.com/profile.php?id=61585613713653'>Facebook</a>\nSend URL:", 'finish_tasks'));

bot.action('finish_tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const summary = `🎉 <b>Congratulations, ${username}!</b>\n\n✅ Social tasks processed.\n💰 Rewards: ${user.taskBalance || 0} Nxracoin\n💵 Total Balance: ${user.balance} Nxracoin`;
    ctx.replyWithHTML(summary);
});

// --- ৭. মেসেজ লিসেনার (Text input handling) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    if (['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'].includes(text)) return;

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    const steps = { 'ASK_EMAIL': 'step_tg', 'ASK_TG': 'step_twitter', 'ASK_TW': 'step_retweet', 'ASK_RT': 'step_linkedin', 'ASK_LI': 'step_facebook' };
    
    if (steps[user.actionState]) {
        const next = steps[user.actionState];
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ Detail Saved! +1000 Nxracoin.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', next)]]));
    } else if (user.actionState === 'ASK_FB') {
        const finalUser = await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: TASK_REWARD, taskBalance: TASK_REWARD }, actionState: 'IDLE' }, {new: true});
        const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
        ctx.replyWithHTML(`🎉 <b>Congratulations ${username}!</b>\nTasks Completed.\n💰 Rewards: ${finalUser.taskBalance} Nxracoin.`);
    } else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: ${amt} Nxracoin | @${ctx.from.username} | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal request submitted!");
        } else ctx.reply("❌ Invalid balance.");
    }
});

// Callbacks for withdrawal
bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount to Withdraw:"); });

// Admin Stats
bot.command('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    const count = await User.countDocuments();
    ctx.reply(`📊 Total Registered Users: ${count}`);
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

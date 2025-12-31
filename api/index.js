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
            serverSelectionTimeoutMS: 10000
        });
        console.log("DB Connected");
    } catch (e) { console.error("DB connection error"); }
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    email: { type: String, default: 'Not Submitted' },
    twitter: { type: String, default: 'Not Submitted' },
    retweet: { type: String, default: 'Not Submitted' },
    linkedin: { type: String, default: 'Not Submitted' },
    facebook: { type: String, default: 'Not Submitted' },
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

// --- ৩. মেইন মেনু কিবোর্ড ---
const mainMenu = Markup.inlineKeyboard([
    [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
    [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
    [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
    [Markup.button.callback('☎️ Support', 'support')]
]);

// --- ৪. স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            let startBal = (refId && Number(refId) !== userId) ? 5000 : 0;
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: startBal,
                referredBy: (refId && Number(refId) !== userId) ? Number(refId) : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000, referralCount: 1 } });
                bot.telegram.sendMessage(user.referredBy, `🎁 *Referral Bonus!* A friend joined. You got 5000 NXRA!`).catch(e=>{});
            }
            if(startBal > 0) ctx.reply("🎁 You received 5000 NXRA for joining via referral!");
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Complete tasks, mine daily, and refer friends to earn!`, mainMenu);
    } catch (e) { console.error(e); }
});

// --- ৫. রেফারেল এবং বোনাস (Fix) ---
bot.action('get_ref', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const msg = `👥 *Referral Program*\n\n🎁 Join Bonus: 5000 NXRA\n💰 Ref Reward: 5000 NXRA\n\n📊 Invited: ${user.referralCount || 0} users\n💎 Earned: ${(user.referralCount || 0) * 5000} NXRA\n\n🔗 *Link:* \n${refLink}`;
        ctx.replyWithMarkdown(msg);
    } catch (e) { ctx.reply("❌ Error loading referral info."); }
});

bot.action('bonus', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const now = new Date();
        if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
            ctx.reply("🎁 +500 NXRA Daily Bonus Claimed!");
        } else ctx.reply("❌ Already claimed today!");
    } catch (e) { console.error(e); }
});

// --- ৬. সোশ্যাল টাস্ক এবং স্কিপ লজিক ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply("📋 *Nxracoin Social Tasks* (6000 NXRA Total)\n\nEarn 1000 NXRA for each completed task. Click below to start:", 
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

const taskStep = async (ctx, state, text, skip) => {
    try {
        await connectDB();
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
        ctx.replyWithMarkdown(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skip)]]));
    } catch (e) { console.error(e); }
};

bot.action('step_email', (ctx) => taskStep(ctx, 'ASK_EMAIL', "📧 *Step 1:* Send your *Email Address*:", 'step_tg'));
bot.action('step_tg', (ctx) => taskStep(ctx, 'ASK_TG', "📢 *Step 2:* Join [Channel](https://t.me/+FfYvprJBYEMwYTJl) & [Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *Send Telegram Username:*", 'step_twitter'));
bot.action('step_twitter', (ctx) => taskStep(ctx, 'ASK_TW', "🐦 *Step 3:* Follow [Twitter](https://x.com/Nxracoin)\n\n👇 *Send Twitter Username:*", 'step_retweet'));
bot.action('step_retweet', (ctx) => taskStep(ctx, 'ASK_RT', "🔥 *Step 4:* Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186?s=20)\n\n👇 *Send Retweet Link:*", 'step_linkedin'));
bot.action('step_linkedin', (ctx) => taskStep(ctx, 'ASK_LI', "💼 *Step 5:* Follow [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?)\n\n👇 *Send LinkedIn URL:*", 'step_facebook'));
bot.action('step_facebook', (ctx) => taskStep(ctx, 'ASK_FB', "👥 *Step 6:* Follow [Facebook](https://www.facebook.com/profile.php?id=61585613713653)\n\n👇 *Send Facebook URL:*", 'finish_tasks'));

bot.action('finish_tasks', async (ctx) => {
    await ctx.answerCbQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'IDLE' });
    ctx.reply("🎉 Social tasks finished! Rewards added for completed tasks.");
});

// --- ৭. মেসেজ লিসেনার (Reward logic) ---
bot.on('text', async (ctx) => {
    try {
        await connectDB();
        const text = ctx.message.text.trim();
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId });
        if (!user) return;

        const handleTask = async (field, reward, nextAction, msg) => {
            await User.findOneAndUpdate({ telegramId: userId }, { [field]: text, $inc: { balance: reward }, actionState: 'IDLE' });
            ctx.reply(`✅ ${msg} +${reward} NXRA Added!`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextAction)]]));
        };

        if (user.actionState === 'ASK_EMAIL') await handleTask('email', 1000, 'step_tg', "Email saved!");
        else if (user.actionState === 'ASK_TG') await handleTask('username', 1000, 'step_twitter', "Telegram task done!");
        else if (user.actionState === 'ASK_TW') await handleTask('twitter', 1000, 'step_retweet', "Twitter saved!");
        else if (user.actionState === 'ASK_RT') await handleTask('retweet', 1000, 'step_linkedin', "Retweet link saved!");
        else if (user.actionState === 'ASK_LI') await handleTask('linkedin', 1000, 'step_facebook', "LinkedIn saved!");
        else if (user.actionState === 'ASK_FB') {
            await User.findOneAndUpdate({ telegramId: userId }, { facebook: text, $inc: { balance: 1000 }, actionState: 'IDLE' });
            ctx.reply("✅ Facebook saved! +1000 NXRA. All tasks done! 🎉");
        }
        else if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
            await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
            ctx.reply("✅ Wallet Saved!");
        }
        else if (user.actionState === 'AWAITING_AMOUNT') {
            const amt = Number(text);
            if (amt > 0 && amt <= user.balance) {
                await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amt }, actionState: 'IDLE' });
                bot.telegram.sendMessage(ADMIN_ID, `Withdraw: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
                ctx.reply("✅ Withdrawal submitted!");
            } else ctx.reply("❌ Invalid amount.");
        }
    } catch (e) { console.error(e); }
});

// অন্যান্য উইথড্র অ্যাকশন
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Withdrawal*\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: \`${user.wallet || 'Not Set'}\``, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' }); ctx.reply("Enter amount to withdraw:"); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, referralCount: 0 });
    ctx.reply("✅ Data Reset!");
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

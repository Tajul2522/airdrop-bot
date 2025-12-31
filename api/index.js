const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
    } catch (e) { console.error("DB Connection Failed"); }
};

// ২. ডাটাবেজ স্কিমা (নতুন টাস্ক ফিল্ড সহ)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    email: { type: String, default: null },
    twitterLink: { type: String, default: null },
    linkedinLink: { type: String, default: null },
    facebookLink: { type: String, default: null },
    wallet: { type: String, default: null },
    balance: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    actionState: { type: String, default: 'IDLE' },
    completedTasks: { type: Array, default: [] } // কোন টাস্কগুলো শেষ হয়েছে তা ট্র্যাক করতে
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=18.0";
const TASK_REWARD = 1000;

// --- ৩. স্টার্ট কমান্ড ---
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
                bot.telegram.sendMessage(user.referredBy, `🎁 *Referral Bonus!* You earned 5000 NXRA!`).catch(e=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Join our airdrop and earn big rewards!`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [Markup.button.callback('📝 Social Tasks (6,000 NXRA)', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
                [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); }
});

// --- ৪. সোশ্যাল টাস্ক ফ্লো (Step-by-Step) ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery();
    const taskMsg = `📋 *Nxracoin Mandatory Tasks* (6,000 NXRA Total)\n\n` +
        `1️⃣ Submit Email Address\n` +
        `2️⃣ Join Telegram Channel\n` +
        `3️⃣ Join Telegram Group\n` +
        `4️⃣ Follow Twitter\n` +
        `5️⃣ Like, Comment & Retweet Post\n` +
        `6️⃣ Follow LinkedIn\n` +
        `7️⃣ Follow Facebook Page\n\n` +
        `👇 *Click the button below to start submitting details one by one.*`;

    ctx.replyWithMarkdown(taskMsg, Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Start Submitting Details', 'step_email')]
    ]));
});

// Step 1: Email
bot.action('step_email', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'ASK_EMAIL' });
    ctx.reply("📧 Step 1: Please enter your *Email Address*:");
});

// --- ৫. মেসেজ লিসেনার (Wizard Logic) ---
bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    // Email logic
    if (user.actionState === 'ASK_EMAIL') {
        if (text.includes('@') && text.includes('.')) {
            user.email = text;
            user.actionState = 'ASK_TG_JOIN';
            await user.save();
            ctx.replyWithMarkdown(`✅ Email saved!\n\n📢 *Step 2 & 3:* Join our Channel and Group:\n\n1. [Telegram Channel](https://t.me/+FfYvprJBYEMwYTJl)\n2. [Telegram Group](https://t.me/+jPnGAXqmb-liYzM1)\n\n👇 *After joining, send your Telegram Username (e.g. @yourname):*`);
        } else ctx.reply("❌ Please enter a valid email.");
    }
    // Telegram Join Logic
    else if (user.actionState === 'ASK_TG_JOIN') {
        user.balance += 2000; // Reward for 2 TG tasks
        user.actionState = 'ASK_TWITTER';
        await user.save();
        ctx.replyWithMarkdown(`✅ +2,000 NXRA Added!\n\n🐦 *Step 4:* Follow our [Twitter](https://x.com/Nxracoin).\n\n👇 *Send your Twitter Username (e.g. @yourname):*`);
    }
    // Twitter Logic
    else if (user.actionState === 'ASK_TWITTER') {
        user.balance += 1000;
        user.actionState = 'ASK_RETWEET';
        await user.save();
        ctx.replyWithMarkdown(`✅ +1,000 NXRA Added!\n\n🔥 *Step 5:* Like, Comment & Retweet [This Post](https://x.com/Nxracoin/status/2006308628375245186?s=20).\n\n👇 *Send your Retweet Link:*`);
    }
    // Retweet Logic
    else if (user.actionState === 'ASK_RETWEET') {
        user.balance += 1000;
        user.actionState = 'ASK_LINKEDIN';
        await user.save();
        ctx.replyWithMarkdown(`✅ +1,000 NXRA Added!\n\n💼 *Step 6:* Follow our [LinkedIn](https://www.linkedin.com/in/nxracoin-mining-186ba23a3?).\n\n👇 *Send your LinkedIn Profile URL:*`);
    }
    // LinkedIn Logic
    else if (user.actionState === 'ASK_LINKEDIN') {
        user.balance += 1000;
        user.actionState = 'ASK_FACEBOOK';
        await user.save();
        ctx.replyWithMarkdown(`✅ +1,000 NXRA Added!\n\n👥 *Step 7:* Follow our [Facebook Page](https://www.facebook.com/profile.php?id=61585613713653).\n\n👇 *Send your Facebook Profile URL:*`);
    }
    // Facebook Logic (Final)
    else if (user.actionState === 'ASK_FACEBOOK') {
        user.balance += 1000;
        user.facebookLink = text;
        user.actionState = 'IDLE';
        await user.save();
        ctx.replyWithMarkdown(`🎉 *Congratulations!* You have completed all social tasks.\n💰 *6,000 Nxracoin* have been added to your balance!\n\nUse the menu to continue mining and referring friends.`);
    }
    // Withdraw Wallet/Amount (আগের মতো)
    else if (user.actionState === 'AWAITING_WALLET') {
        user.wallet = text; user.actionState = 'IDLE'; await user.save();
        ctx.reply("✅ Wallet Saved!");
    }
    else if (user.actionState === 'AWAITING_AMOUNT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            user.balance -= amt; user.actionState = 'IDLE'; await user.save();
            bot.telegram.sendMessage(ADMIN_ID, `Withdraw: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal Submitted!");
        } else ctx.reply("❌ Invalid amount.");
    }
});

// --- ৬. অন্যান্য অ্যাকশন ---
bot.action('get_ref', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithMarkdown(`👥 *Invite & Earn*\n🎁 Referral: 5000 NXRA\n🎁 Join Bonus: 5000 NXRA\n\n🔗 *Link:* \n${refLink}`);
    await ctx.answerCbQuery();
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.replyWithMarkdown(`🏦 *Withdraw*\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: \`${user.wallet || 'Not Set'}\``, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery(); await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA Daily Bonus Claimed!");
    } else ctx.reply("❌ Already claimed!");
});

bot.action('ask_wallet', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter Nxracoin amount:");
});

bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, referralCount: 0 });
    ctx.reply("✅ Admin Reset Successful!");
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

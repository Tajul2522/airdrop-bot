const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; 

// ১. ডাটাবেজ কানেকশন লজিক (নিরাপদ পদ্ধতি)
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
    } catch (e) { console.error("DB Error"); }
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
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;

// --- ৩. স্টার্ট কমান্ড (রেফারেল ফিক্সড) ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload; // লিঙ্কের পেছনের আইডি

        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            let inviterId = null;
            let startBalance = 0;

            // রেফারেল চেক
            if (refId && !isNaN(refId) && Number(refId) !== userId) {
                inviterId = Number(refId);
                startBalance = JOIN_BONUS; // নতুন জয়েন করা ইউজার ৫০০০ পাবে
            }

            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                balance: startBalance,
                referredBy: inviterId
            });
            await user.save();

            // রেফারারকে ৫০০০ দেওয়া
            if (inviterId) {
                await User.findOneAndUpdate({ telegramId: inviterId }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(inviterId, `🎁 *Referral Bonus!* Someone joined using your link. You earned ${REF_BONUS} NXRA!`).catch(e=>{});
            }
            
            if (startBalance > 0) {
                ctx.reply(`🎁 Welcome! You earned ${JOIN_BONUS} NXRA for joining via referral link!`);
            }
        }
        
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        const menu = Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Social Tasks', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]);

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Earn rewards by daily mining and inviting friends!`, menu);
    } catch (e) { 
        console.error(e);
        ctx.reply("Welcome! Use /start again if you don't see the menu.");
    }
});

// --- ৪. রেফারেল তথ্য (একদম সিম্পল ও নিরাপদ) ---
bot.action('get_ref', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
        const earned = (user.referralCount || 0) * REF_BONUS;

        const msg = `👥 *Nxracoin Invite & Earn* 👥\n\n` +
                    `🎁 *Join Bonus:* 5000 NXRA\n` +
                    `💰 *Per Referral:* 5000 NXRA\n\n` +
                    `📊 *Total Invited:* ${user.referralCount || 0} Users\n` +
                    `💎 *Total Earned:* ${earned} NXRA\n\n` +
                    `🔗 *Your Link:* \n${refLink}`;

        ctx.replyWithMarkdown(msg);
    } catch (e) { ctx.reply("System busy, try again."); }
});

// --- ৫. সোশ্যাল টাস্ক (With Skip) ---
bot.action('tasks', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{});
    ctx.replyWithMarkdown(`📋 *Social Tasks* (6,000 NXRA Total)\n\nComplete each task to earn 1000 NXRA. Skip if you can't do it.\n\n👇 *Submit Twitter @username to start:*`,
    Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip All Tasks', 'back_home')]]));
});

// --- অন্যান্য প্রয়োজনীয় বাটন ---
bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{});
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 500 NXRA Daily Bonus Claimed!");
    } else ctx.reply("❌ Claim tomorrow!");
});

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(()=>{});
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n💰 Balance: ${user.balance} NXRA\n${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amt')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.on('text', async (ctx) => {
    await connectDB();
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Saved!");
    } else if (user.actionState === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `🚀 New Withdraw: ${amt} NXRA from @${ctx.from.username}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount.");
    } else if (text.startsWith('@')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 1000 } });
        ctx.reply("✅ Twitter task rewarded! +1000 NXRA");
    }
});

bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet:"); });
bot.action('ask_amt', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter Amount:"); });
bot.action('support', (ctx) => ctx.reply("Support: @tajul15"));
bot.action('back_home', (ctx) => ctx.reply("Back to Menu: Use /start"));

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, balance: 0, referralCount: 0, actionState: 'IDLE' });
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

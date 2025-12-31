const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 
const BOT_USERNAME = "Nxracoin_bot"; // আপনার বটের ইউজারনেম

// ১. ডাটাবেজ কানেকশন অপ্টিমাইজড
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
    } catch (e) {
        console.error("MongoDB Error");
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

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=17.0";

// --- ৩. রেফারেল লজিক (Simplified & Debug Mode) ---
bot.action('get_ref', async (ctx) => {
    try {
        await ctx.answerCbQuery().catch(() => {});
        await connectDB();
        
        const userId = ctx.from.id;
        
        // তথ্য খোঁজার সময় সর্বোচ্চ ৩ সেকেন্ড সময় নিবে
        const user = await User.findOne({ telegramId: userId }).maxTimeMS(3000);
        
        if (!user) {
            return ctx.reply("❌ Data not found! Please send /start to register again.");
        }

        const refLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        const totalRefBonus = (user.referralCount || 0) * 5000;

        const refMsg = `👥 *Nxracoin Invite & Earn*\n\n` +
            `🎁 *Reward:* 5000 NXRA / Referral\n` +
            `📊 *Referrals:* ${user.referralCount || 0} Users\n` +
            `💰 *Earned:* ${totalRefBonus} Nxracoin\n\n` +
            `🔗 *Your Link:* \n${refLink}`;

        await ctx.replyWithMarkdown(refMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_home')]
        ]));

    } catch (error) {
        // যদি এরর হয়, তবে অ্যাডমিনকে আসল কারণ জানাবে
        console.error(error);
        await ctx.reply(`❌ Connection issue: ${error.message.substring(0, 30)}...\nPlease click Referral again.`);
    }
});

// --- ৪. মেনু এবং স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                referredBy: refId && Number(refId) !== userId ? Number(refId) : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000, referralCount: 1 } });
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        const welcomeText = `👋 *Welcome to Nxracoin Reward Bot!* \n\n🚀 Earn Nxracoin daily by mining, bonus, and referrals.`;

        ctx.replyWithMarkdown(welcomeText, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'get_ref')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { ctx.reply("❌ Database connecting... please wait 5s and /start"); }
});

// --- ৫. অন্যান্য অ্যাকশন ---
bot.action('back_home', (ctx) => ctx.reply("Main Menu: Use /start"));

bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletText = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    ctx.replyWithMarkdown(`🏦 *Withdrawal Dashboard*\n\n💰 *Balance:* ${user.balance} NXRA\n${walletText}`, Markup.inlineKeyboard([
        [!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],
        [Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]
    ]));
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply("🎁 Bonus claimed! +500 Nxracoin ⚡");
    } else { ctx.reply("❌ Already claimed today! Come back tomorrow."); }
});

bot.on('text', async (ctx) => {
    try {
        await connectDB();
        const text = ctx.message.text.trim();
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) return;

        if (user.actionState === 'AWAITING_WALLET' && text.startsWith('0x')) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
            ctx.reply("✅ Wallet Saved Successfully!");
        } else if (user.actionState === 'AWAITING_AMOUNT') {
            const amt = Number(text);
            if (amt > 0 && amt <= user.balance) {
                await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
                bot.telegram.sendMessage(ADMIN_ID, `Withdrawal: @${ctx.from.username} | ${amt} NXRA | Wallet: ${user.wallet}`);
                ctx.reply("✅ Request submitted!");
            } else ctx.reply("❌ Invalid amount.");
        }
    } catch (e) {}
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("Send BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("Enter Nxracoin amount to withdraw:");
});

bot.action('tasks', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply("📋 Tasks: Join @YourChannel"); });
bot.action('support', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply("Support: @tajul15"); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE' });
    ctx.reply("✅ Admin Data Reset!");
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
            const now = new Date();
            if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > 43200000)) {
                await User.findOneAndUpdate({ telegramId: Number(userId) }, { $inc: { balance: 1000 }, lastMining: now });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

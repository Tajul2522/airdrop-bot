const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 

// ১. ডাটাবেজ কানেকশন হ্যান্ডলিং (মাস্টার কানেকশন)
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");
    } catch (e) { 
        console.error("MongoDB Connection Error", e); 
    }
};

// ২. ডাটাবেজ স্কিমা
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    twitter: { type: String, default: 'Not Submitted' },
    wallet: { type: String, default: null },
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null },
    lastDailyBonus: { type: Date, default: null },
    referralCount: { type: Number, default: 0 },
    actionState: { type: String, default: 'IDLE' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=12.0";
const REFER_BONUS = 5000;

// --- স্টার্ট কমান্ড ---
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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REFER_BONUS, referralCount: 1 } });
            }
        }
        
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!* 🌟\n\n🚀 Earn Nxracoin daily by mining and completing tasks.`;
        
        ctx.replyWithMarkdown(welcomeMsg, Markup.inlineKeyboard([
            [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
            [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
            [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('👥 Referral', 'referral_info')],
            [Markup.button.callback('☎️ Support', 'support')]
        ]));
    } catch (e) { console.error("Start Error:", e); }
});

// --- ৩. রেফারেল তথ্য (নতুন এবং ফিক্সড লজিক) ---
bot.action('referral_info', async (ctx) => {
    // বাটন ক্লিক রিকভারি
    await ctx.answerCbQuery().catch(() => {});
    
    try {
        await connectDB();
        const userId = ctx.from.id;
        
        // ইউজার ডাটা চেক
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            // যদি কোনো কারণে ইউজার ডাটা না থাকে, তবে নতুন করে তৈরি করবে
            user = new User({ telegramId: userId, username: ctx.from.username || 'User' });
            await user.save();
        }

        // বটের ইউজারনেম পাওয়া নিশ্চিত করা
        const botUsername = ctx.botInfo ? ctx.botInfo.username : "airdrop_bot"; // Fallback username
        const refLink = `https://t.me/${botUsername}?start=${userId}`;
        const totalCommission = (user.referralCount || 0) * REFER_BONUS;

        const refMsg = `👥 *Nxracoin Referral Program* 👥\n\n` +
            `🎁 *Referral Bonus:* ${REFER_BONUS} Nxracoin / Ref\n` +
            `📊 *Total Referrals:* ${user.referralCount || 0} Users\n` +
            `💰 *Total Commission:* ${totalCommission} Nxracoin\n\n` +
            `🔗 *Your Unique Referral Link:* \n${refLink}\n\n` +
            `📢 Share your link and earn *${REFER_BONUS} Nxracoin* for every friend who joins! 💸`;

        await ctx.replyWithMarkdown(refMsg);
    } catch (e) {
        console.error("Referral Action Error:", e);
        await ctx.reply("❌ Connection unstable. Please try /start again.");
    }
});

// --- ৪. উইথড্র মেনু ---
bot.action('withdraw_menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const walletStatus = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
        const msg = `🏦 *Withdrawal Dashboard* 🏦\n\n💰 *Your Balance:* ${user.balance} Nxracoin\n${walletStatus}\n\n👇 Choose an option:`;
        
        const buttons = [];
        if (!user.wallet) {
            buttons.push([Markup.button.callback('✍️ Set Wallet Address', 'ask_wallet')]);
        } else {
            buttons.push([Markup.button.callback('💸 Withdraw Now', 'ask_amount')]);
            buttons.push([Markup.button.callback('🔄 Change Wallet Address', 'ask_wallet')]);
        }
        ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
    } catch (e) { console.error(e); }
});

// --- মেসেজ লিসেনার (Wallet, Twitter, Amount) ---
bot.on('text', async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const text = ctx.message.text.trim();
        const user = await User.findOne({ telegramId: userId });
        if (!user) return;

        if (user.actionState === 'AWAITING_WALLET') {
            if (text.startsWith('0x') && text.length >= 40) {
                await User.findOneAndUpdate({ telegramId: userId }, { wallet: text, actionState: 'IDLE' });
                ctx.reply(`✅ Wallet Address Saved!`, Markup.inlineKeyboard([[Markup.button.callback('🏦 Withdraw Menu', 'withdraw_menu')]]));
            } else ctx.reply("❌ Invalid Wallet! Send a valid BEP-20 address.");
        } 
        else if (user.actionState === 'AWAITING_AMOUNT') {
            const amount = Number(text);
            if (isNaN(amount) || amount <= 0 || amount > user.balance) {
                ctx.reply("❌ Invalid amount or insufficient balance!");
            } else {
                await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: -amount }, actionState: 'IDLE' });
                bot.telegram.sendMessage(ADMIN_ID, `🚀 *New Withdrawal!* \nUser: @${user.username}\nAmount: ${amount}\nWallet: ${user.wallet}`);
                ctx.reply(`✅ Request for ${amount} Nxracoin submitted!`);
            }
        }
        else if (text.startsWith('@')) {
            await User.findOneAndUpdate({ telegramId: userId }, { twitter: text });
            ctx.reply(`✅ Twitter username ${text} saved!`);
        }
    } catch (e) { console.error(e); }
});

bot.action('ask_wallet', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("✍️ Send your BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("💰 Enter the amount you want to withdraw:");
});

bot.action('bonus', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: now });
        ctx.reply(`🎁 Bonus claimed! +500 Nxracoin`);
    } else { ctx.reply("❌ Already claimed! Come back tomorrow."); }
});

bot.action('tasks', (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    ctx.replyWithMarkdown(`📋 *Tasks:*\n1. Join @YourChannel\n\nClick to submit Twitter username:`, Markup.inlineKeyboard([[Markup.button.callback('✍️ Submit Twitter', 'sub_twitter')]]));
});

bot.action('sub_twitter', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply('Send your Twitter @username:'); });
bot.action('support', (ctx) => { ctx.answerCbQuery().catch(() => {}); ctx.reply('Contact Admin: @YourAdmin'); });

// --- ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
    try {
        await connectDB();
        if (req.method === 'GET') {
            const { userId } = req.query;
            let user = await User.findOne({ telegramId: Number(userId) });
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

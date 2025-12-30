const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; 

// ১. ডাটাবেজ কানেকশন (নিরাপদ পদ্ধতি)
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        isConnected = true;
        console.log("DB Connected");
    } catch (e) { console.error("DB Connection Failed", e); }
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

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=9.5";
const REFER_BONUS = 5000;

// --- এডমিন কমান্ড ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, referralCount: 0, actionState: 'IDLE' });
    ctx.reply("✅ Admin: Data Reset Successfully!");
});

// --- স্টার্ট কমান্ড (বট মেনু) ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;

    try {
        await connectDB();
        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                referredBy: refId && Number(refId) !== userId ? Number(refId) : null
            });
            await user.save();

            if (user.referredBy) {
                await User.findOneAndUpdate(
                    { telegramId: user.referredBy }, 
                    { $inc: { balance: REFER_BONUS, referralCount: 1 } }
                );
            }
        }
        
        user.actionState = 'IDLE';
        await user.save();

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!* 🌟\n\n🚀 Earn Nxracoin daily by mining and completing tasks.`;

        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [
                    Markup.button.callback('📝 Start Task', 'tasks'), 
                    Markup.button.callback('🎁 Daily Bonus', 'bonus')
                ],
                [
                    Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), 
                    Markup.button.callback('👥 Referral', 'referral_info') 
                ],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); }
});

// --- ৩. রেফারেল তথ্য (Fix: referral_info) ---
bot.action('referral_info', async (ctx) => {
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        const totalCommission = (user.referralCount || 0) * REFER_BONUS;

        const refMsg = `👥 *Nxracoin Referral Program* 👥\n\n` +
            `🎁 *Referral Bonus:* ${REFER_BONUS} Nxracoin / Ref\n` +
            `📊 *Total Referrals:* ${user.referralCount || 0} Users\n` +
            `💰 *Total Commission:* ${totalCommission} Nxracoin\n\n` +
            `🔗 *Your Unique Referral Link:* \n${refLink}\n\n` +
            `📢 Share your link and earn *${REFER_BONUS} Nxracoin* for every friend who joins! 💸`;

        // ইউজারকে মেসেজ পাঠানো
        await ctx.replyWithMarkdown(refMsg);
        // বাটন লোডিং বন্ধ করার জন্য answerCbQuery জরুরি
        await ctx.answerCbQuery(); 
    } catch (e) { 
        console.error(e);
        ctx.answerCbQuery("Error loading referral data."); 
    }
});

// --- ৪. উইথড্র মেনু (এখান থেকেও ব্যালেন্স দেখা যাবে) ---
bot.action('withdraw_menu', async (ctx) => {
    try {
        await connectDB();
        const user = await User.findOne({ telegramId: ctx.from.id });
        const walletStatus = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
        const msg = `🏦 *Withdrawal Dashboard* 🏦\n\n` +
                    `💰 *Your Balance:* ${user.balance} Nxracoin\n` +
                    `${walletStatus}\n\n` +
                    `👇 Choose an option:`;
        
        const buttons = [];
        if (!user.wallet) {
            buttons.push([Markup.button.callback('✍️ Set Wallet Address', 'ask_wallet')]);
        } else {
            buttons.push([Markup.button.callback('💸 Withdraw Now', 'ask_amount')]);
            buttons.push([Markup.button.callback('🔄 Change Wallet Address', 'ask_wallet')]);
        }
        
        ctx.replyWithMarkdown(msg, Markup.inlineKeyboard(buttons));
        await ctx.answerCbQuery();
    } catch (e) { ctx.answerCbQuery("Error loading menu."); }
});

// --- ৫. মেসেজ লিসেনার (Wallet, Amount, Twitter) ---
bot.on('text', async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const text = ctx.message.text.trim();
        const user = await User.findOne({ telegramId: userId });
        if (!user) return;

        if (user.actionState === 'AWAITING_WALLET') {
            if (text.startsWith('0x') && text.length >= 40) {
                user.wallet = text; user.actionState = 'IDLE'; await user.save();
                ctx.reply(`✅ Wallet Address Saved!`, Markup.inlineKeyboard([[Markup.button.callback('🏦 Back to Withdraw', 'withdraw_menu')]]));
            } else ctx.reply("❌ Invalid Wallet! Please send BEP-20 address.");
        } 
        else if (user.actionState === 'AWAITING_AMOUNT') {
            const amount = Number(text);
            if (isNaN(amount) || amount <= 0 || amount > user.balance) {
                ctx.reply("❌ Invalid amount or insufficient balance!");
            } else {
                user.balance -= amount; user.actionState = 'IDLE'; await user.save();
                bot.telegram.sendMessage(ADMIN_ID, `🚀 *Withdrawal Request!*\nUser: @${user.username}\nAmount: ${amount}\nWallet: \`${user.wallet}\``, { parse_mode: 'Markdown' });
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
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("✍️ Please send your *BEP-20 Wallet Address*: ");
    await ctx.answerCbQuery();
});

bot.action('ask_amount', async (ctx) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("💰 Enter the amount you want to withdraw:");
    await ctx.answerCbQuery();
});

bot.action('bonus', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        user.balance += 500; user.lastDailyBonus = now; await user.save();
        ctx.answerCbQuery(`🎁 +500 Nxracoin Claimed!`, { show_alert: true });
    } else { ctx.answerCbQuery("❌ Claim tomorrow!", { show_alert: true }); }
});

bot.action('tasks', (ctx) => ctx.reply(`📋 *Tasks:*\n1. Join @YourChannel\n\nClick button to submit:`, Markup.inlineKeyboard([[Markup.button.callback('✍️ Submit Username', 'sub_twitter')]])));
bot.action('sub_twitter', (ctx) => ctx.reply('Send your Twitter @username:'));
bot.action('support', (ctx) => ctx.reply('Contact Support: @YourAdmin'));

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
                user.balance += 1000; user.lastMining = now; await user.save();
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ success: false });
        }
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
        }
        res.status(200).send('OK');
    } catch (err) { res.status(200).send('OK'); }
};

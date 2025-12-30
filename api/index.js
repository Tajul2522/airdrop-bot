const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797;

// ১. ডাটাবেজ স্কিমা
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

mongoose.connect(process.env.MONGO_URI);

const APP_URL = "https://airdrop-bot-nine.vercel.app/app.html?v=8.0";
const REFER_BONUS = 5000;

// --- এডমিন কমান্ড ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, balance: 0, referralCount: 0, actionState: 'IDLE' });
    ctx.reply("✅ Admin: All your data has been reset for testing!");
});

// --- স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;
    try {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', referredBy: refId && Number(refId) !== userId ? Number(refId) : null });
            await user.save();
            if (user.referredBy) await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: REFER_BONUS, referralCount: 1 } });
        }
        user.actionState = 'IDLE';
        await user.save();

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', APP_URL)],
                [Markup.button.callback('📝 Start Task', 'tasks'), Markup.button.callback('🎁 Daily Bonus', 'bonus')],
                [Markup.button.callback('🏦 Withdraw', 'withdraw_menu'), Markup.button.callback('💰 Balance', 'balance_info')],
                [Markup.button.callback('☎️ Support', 'support')]
            ])
        );
    } catch (e) { console.error(e); }
});

// --- ২. আপডেট করা ব্যালেন্স ও রেফারেল ডিটেইলস ---
bot.action('balance_info', async (ctx) => {
    try {
        const user = await User.findOne({ telegramId: ctx.from.id });
        const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        const totalRefCommission = (user.referralCount || 0) * REFER_BONUS;

        const balanceMsg = `💎 *Your Nxracoin Balance Details* 💎\n\n` +
            `💰 *Total Balance:* ${user.balance} Nxracoin\n` +
            `👥 *Total Referrals:* ${user.referralCount || 0} Users\n` +
            `🎁 *Referral Commission:* ${totalRefCommission} Nxracoin\n\n` +
            `🔗 *Your Unique Referral Link:* \n${refLink}\n\n` +
            `📢 *Note:* You earn ${REFER_BONUS} Nxracoin for every friend who joins using your link!`;

        ctx.replyWithMarkdown(balanceMsg, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'back_start')]
        ]));
    } catch (e) { ctx.reply("Error loading balance."); }
});

// --- ৩. উইথড্র মেনু (অ্যামাউন্ট ও ওয়ালেট ম্যানেজমেন্ট) ---
bot.action('withdraw_menu', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const walletStatus = user.wallet ? `💳 *Wallet:* \`${user.wallet}\`` : "⚠️ *Wallet:* Not Set";
    const msg = `🏦 *Withdrawal Dashboard*\n\n💰 *Balance:* ${user.balance} NXRA\n${walletStatus}\n\nChoose an option:`;
    
    const buttons = [];
    if (!user.wallet) buttons.push([Markup.button.callback('✍️ Set Wallet Address', 'ask_wallet')]);
    else {
        buttons.push([Markup.button.callback('💸 Withdraw Nxracoin', 'ask_amount')]);
        buttons.push([Markup.button.callback('🔄 Change Wallet Address', 'ask_wallet')]);
    }
    buttons.push([Markup.button.callback('⬅️ Back to Menu', 'back_start')]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});

bot.action('ask_wallet', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' });
    ctx.reply("✍️ Send your BEP-20 Wallet Address:");
});

bot.action('ask_amount', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMOUNT' });
    ctx.reply("💰 Enter the Nxracoin amount to withdraw:");
});

// --- মেসেজ হ্যান্ডলার ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    if (user.actionState === 'AWAITING_WALLET') {
        if (text.startsWith('0x') && text.length >= 40) {
            user.wallet = text; user.actionState = 'IDLE'; await user.save();
            ctx.reply(`✅ Wallet saved: ${text}`, Markup.inlineKeyboard([[Markup.button.callback('🏦 Withdraw Menu', 'withdraw_menu')]]));
        } else ctx.reply("❌ Invalid Wallet!");
    } 
    else if (user.actionState === 'AWAITING_AMOUNT') {
        const amount = Number(text);
        if (isNaN(amount) || amount <= 0 || amount > user.balance) ctx.reply("❌ Invalid amount or insufficient balance!");
        else {
            user.balance -= amount; user.actionState = 'IDLE'; await user.save();
            bot.telegram.sendMessage(ADMIN_ID, `🚀 *Withdraw!* \nUser: @${user.username}\nAmount: ${amount}\nWallet: ${user.wallet}`);
            ctx.reply(`✅ Request submitted for ${amount} Nxracoin!`, Markup.inlineKeyboard([[Markup.button.callback('🏦 Back', 'withdraw_menu')]]));
        }
    }
    else if (text.startsWith('@')) {
        await User.findOneAndUpdate({ telegramId: userId }, { twitter: text });
        ctx.reply(`✅ Twitter ${text} saved!`);
    }
});

bot.action('back_start', (ctx) => ctx.reply("Use /start to return to the main menu."));
bot.action('bonus', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const now = new Date();
    if (!user.lastDailyBonus || (now.getTime() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        user.balance += 500; user.lastDailyBonus = now; await user.save();
        ctx.answerCbQuery(`🎁 +500 Nxracoin Claimed!`, { show_alert: true });
    } else ctx.answerCbQuery("❌ Claim tomorrow!", { show_alert: true });
});

bot.action('tasks', (ctx) => ctx.reply(`📋 *Tasks:*\n1. Join @YourChannel\n\nClick to submit:`, Markup.inlineKeyboard([[Markup.button.callback('✍️ Twitter Username', 'sub_twitter')]])));
bot.action('sub_twitter', (ctx) => ctx.reply('Send @username:'));
bot.action('support', (ctx) => ctx.reply('Contact: @YourAdmin'));

// --- ভার্সেল হ্যান্ডলার ---
module.exports = async (req, res) => {
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
        return res.status(200).json({ success: false });
    }
    if (req.method === 'POST') {
        try { await bot.handleUpdate(req.body); res.status(200).send('OK'); } catch (e) { res.status(200).send('OK'); }
    } else res.status(200).send('Nxracoin Running');
};

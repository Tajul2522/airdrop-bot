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

// 2. Database Schema (Added pendingTaskReward)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    taskBalance: { type: Number, default: 0 },
    pendingTaskReward: { type: Number, default: 0 }, // টাস্ক চলাকালীন সাময়িক ব্যালেন্স
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

mongoose.connect(process.env.MONGO_URI);

const APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=${Date.now()}`;
const JOIN_BONUS = 5000;
const REF_BONUS = 5000;
const TASK_REWARD = 1000;

// --- 3. Validation Helpers ---
const isValidEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
const isValidTwitter = (text) => text.includes('x.com/') || text.includes('twitter.com/');
const isValidRetweet = (text) => (text.includes('x.com/') || text.includes('twitter.com/')) && text.includes('/status/');
const isValidLinkedIn = (text) => text.includes('linkedin.com/');
const isValidFacebook = (text) => text.includes('facebook.com/');

// --- 4. Task Finalization (The Security Logic) ---
const finalizeTasks = async (ctx, user) => {
    const totalEarned = user.pendingTaskReward;
    
    // মেইন ব্যালেন্সে টাকা যোগ হবে শুধুমাত্র এখন
    const finalUser = await User.findOneAndUpdate(
        { telegramId: user.telegramId },
        { 
            $inc: { balance: totalEarned, taskBalance: totalEarned }, 
            pendingTaskReward: 0, 
            actionState: 'IDLE', 
            allTasksFinished: true 
        },
        { new: true }
    );

    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.telegramId}`;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    
    const summaryMsg = `🎉 <b>Congratulations, ${username}!</b>\n\n` +
        `✅ <b>Status:</b> All tasks submitted for review.\n` +
        `💰 <b>Task Rewards:</b> ${totalEarned} NXRA\n` +
        `💵 <b>Total Balance:</b> ${finalUser.balance} NXRA\n\n` +
        `👥 <b>Total Referrals:</b> ${finalUser.referralCount || 0}\n` +
        `🔗 <b>Your Link:</b>\n${refLink}\n\n` +
        `⚠️ <i>Admin will verify details manually. Fake links = Permanent Ban!</i>`;

    return ctx.replyWithHTML(summaryMsg);
};

const askStep = async (ctx, state, text, skip) => {
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: state });
    return ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⏭️ Skip This Task', skip)]]));
};

// --- 5. Bot Commands ---

bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;
        let user = await User.findOne({ telegramId: userId });

        if (!user) {
            let inviter = (refId && Number(refId) !== userId) ? Number(refId) : null;
            user = new User({ telegramId: userId, username: ctx.from.username || 'User', balance: inviter ? JOIN_BONUS : 0, referredBy: inviter });
            await user.save();
            if (inviter) {
                await User.findOneAndUpdate({ telegramId: inviter }, { $inc: { balance: REF_BONUS, referralCount: 1 } });
                bot.telegram.sendMessage(inviter, `🎁 <b>Referral Bonus!</b> You earned 5000 NXRA!`, {parse_mode: 'HTML'}).catch(()=>{});
            }
        }
        await User.findOneAndUpdate({ telegramId: userId }, { actionState: 'IDLE' });
        ctx.replyWithHTML(`👋 <b>Welcome to NXRA Reward Bot!</b>`, 
            Markup.keyboard([['⛏️ Start Daily Mining'],['📝 Social Tasks', '🎁 Daily Bonus'],['🏦 Withdraw', '👥 Referral'],['☎️ Support']]).resize());
    } catch (e) { console.error(e); }
});

bot.hears('📝 Social Tasks', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user && user.allTasksFinished) return ctx.replyWithHTML("✅ <b>Tasks already completed!</b>");
    
    // টাস্ক নতুন করে শুরু করলে পেন্ডিং ব্যালেন্স ০ করা হচ্ছে
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { pendingTaskReward: 0 });
    
    ctx.replyWithHTML(`<b>📋 NXRA Social Tasks</b>\nComplete tasks to earn NXRA. Rewards are added ONLY at the end.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Start Submitting', 'step_email')]]));
});

// Task actions
bot.action('step_email', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_EMAIL', "📧 <b>Step 1:</b> Send Email:", 'step_tg'); });
bot.action('step_tg', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TG', "📢 <b>Step 2:</b> Join Channel & Group. Send TG @username:", 'step_twitter'); });
bot.action('step_twitter', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_TW', "🐦 <b>Step 3:</b> Follow Twitter. Send Profile Link:", 'step_retweet'); });
bot.action('step_retweet', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_RT', "🔥 <b>Step 4:</b> Retweet Post. Send Link:", 'step_linkedin'); });
bot.action('step_linkedin', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_LI', "💼 <b>Step 5:</b> Follow LinkedIn. Send URL:", 'step_facebook'); });
bot.action('step_facebook', (ctx) => { ctx.answerCbQuery(); return askStep(ctx, 'ASK_FB', "👥 <b>Step 6:</b> Follow Facebook. Send URL:", 'finish_tasks'); });

bot.action('finish_tasks', async (ctx) => {
    ctx.answerCbQuery();
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    await finalizeTasks(ctx, user);
});

// --- 6. Message Listener (Strict Validation & Temp Rewards) ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/') || ['⛏️ Start Daily Mining', '📝 Social Tasks', '🎁 Daily Bonus', '🏦 Withdraw', '👥 Referral', '☎️ Support'].includes(text)) return;

    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.actionState === 'IDLE') return;

    // টেম্পোরারি রিওয়ার্ড ফাংশন
    const saveTempReward = async (field, nextAction) => {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { [field]: text, $inc: { pendingTaskReward: TASK_REWARD }, actionState: 'IDLE' });
        ctx.reply(`✅ Saved! +1000 NXRA pending.`, Markup.inlineKeyboard([[Markup.button.callback('➡️ Next Task', nextAction)]]));
    };

    const st = user.actionState;
    if (st === 'ASK_EMAIL' && isValidEmail(text)) await saveTempReward('email', 'step_tg');
    else if (st === 'ASK_TG' && text.startsWith('@')) await saveTempReward('username', 'step_twitter');
    else if (st === 'ASK_TW' && isValidTwitter(text)) await saveTempReward('twitter', 'step_retweet');
    else if (st === 'ASK_RT' && isValidRetweet(text)) await saveTempReward('retweet', 'step_linkedin');
    else if (st === 'ASK_LI' && isValidLinkedIn(text)) await saveTempReward('linkedin', 'step_facebook');
    else if (st === 'ASK_FB' && isValidFacebook(text)) {
        // সর্বশেষ ধাপে টেম্প রিওয়ার্ড বাড়িয়ে ফাইনাল করা হচ্ছে
        const updatedUser = await User.findOneAndUpdate(
            { telegramId: ctx.from.id }, 
            { facebook: text, $inc: { pendingTaskReward: TASK_REWARD }, actionState: 'IDLE' }, 
            { new: true }
        );
        await finalizeTasks(ctx, updatedUser);
    } 
    else if (st === 'AWAITING_WALLET' && text.startsWith('0x')) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { wallet: text, actionState: 'IDLE' });
        ctx.reply("✅ Wallet Address Saved!");
    } else if (st === 'AWAITING_AMT') {
        const amt = Number(text);
        if (amt > 0 && amt <= user.balance) {
            await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: -amt }, actionState: 'IDLE' });
            bot.telegram.sendMessage(ADMIN_ID, `🚀 Withdraw: ${amt} NXRA | Wallet: ${user.wallet}`);
            ctx.reply("✅ Withdrawal submitted!");
        } else ctx.reply("❌ Invalid amount.");
    } else {
        ctx.reply("⚠️ Invalid Format! Enter real details to earn NXRA.");
    }
});

// --- 7. Regular Bot Features ---
bot.hears('⛏️ Start Daily Mining', (ctx) => ctx.replyWithMarkdown(`🚀 *Open App* to mine:`, Markup.inlineKeyboard([[Markup.button.webApp('⛏️ Open Mining App', APP_URL)]])));
bot.hears('🎁 Daily Bonus', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user.lastDailyBonus || (Date.now() - new Date(user.lastDailyBonus).getTime() > 86400000)) {
        await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { balance: 500 }, lastDailyBonus: new Date() });
        ctx.reply("🎁 500 NXRA added!");
    } else ctx.reply("❌ Claim tomorrow!");
});
bot.hears('👥 Referral', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${BOT_USERNAME}?start=${ctx.from.id}`;
    ctx.replyWithHTML(`<b>👥 Referral Program</b>\n\n🎁 Join: 5000 NXRA\n💰 Per Ref: 5000 NXRA\n📊 Total Refs: ${user.referralCount || 0}\n🔗 <b>Your Link:</b>\n${refLink}`);
});
bot.hears('🏦 Withdraw', async (ctx) => {
    await connectDB(); const user = await User.findOne({ telegramId: ctx.from.id });
    const wallet = user.wallet ? `<code>${user.wallet}</code>` : "Not Set";
    ctx.replyWithHTML(`🏦 <b>Withdraw</b>\n💰 Balance: ${user.balance} NXRA\n💳 Wallet: ${wallet}`, Markup.inlineKeyboard([[!user.wallet ? Markup.button.callback('✍️ Set Wallet', 'ask_wallet') : Markup.button.callback('💸 Withdraw Now', 'ask_amount')],[Markup.button.callback('🔄 Change Wallet', 'ask_wallet')]]));
});
bot.hears('☎️ Support', (ctx) => ctx.reply("Support: @tajul15"));
bot.action('ask_wallet', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_WALLET' }); ctx.reply("Send BEP-20 Wallet Address:"); });
bot.action('ask_amount', async (ctx) => { await User.findOneAndUpdate({ telegramId: ctx.from.id }, { actionState: 'AWAITING_AMT' }); ctx.reply("Enter amount:"); });

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null, lastDailyBonus: null, wallet: null, actionState: 'IDLE', balance: 0, taskBalance: 0, pendingTaskReward: 0, referralCount: 0, allTasksFinished: false });
    ctx.reply("✅ Reset!");
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

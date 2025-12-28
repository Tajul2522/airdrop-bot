const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6955416797; // আপনার এডমিন আইডি

// ১. ডাটাবেজ মডেল (Schema)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ২. ডাটাবেজ কানেকশন
mongoose.connect(process.env.MONGO_URI);

// --- এডমিন কমান্ড ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null });
        ctx.reply("✅ Admin: Your mining timer has been reset! Please refresh the Web App.");
    } catch (e) {
        ctx.reply("❌ Reset failed.");
    }
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`📊 Total Registered Users: ${count}`);
});

// --- বটের স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload;
    
    // ক্যাশ এড়াতে লিঙ্কের শেষে ভার্সন যোগ করা হয়েছে
    const WEB_APP_URL = `https://airdrop-bot-nine.vercel.app/mining.html?v=1.2`;

    try {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username,
                referredBy: refId && refId != userId ? refId : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000 } });
            }
        }

        const welcomeMsg = `👋 *Welcome to Nxracoin Reward Bot!*\n\n🚀 Complete all tasks to earn Nxracoin.\n💸 Earn *5000 Nxracoin* for every friend you invite!`;

        ctx.replyWithMarkdown(welcomeMsg, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)],
                [Markup.button.callback('💰 Balance', 'balance')]
            ])
        );
    } catch (e) { console.error(e); }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.reply(`💰 Balance: ${user ? user.balance : 0} Nxracoin`);
});

// --- ভার্সেল হ্যান্ডলার (বট + এপিআই) ---
module.exports = async (req, res) => {
    // ১. ওয়েব অ্যাপের ডাটা পাঠানোর অংশ (GET Request)
    if (req.method === 'GET') {
        const { userId } = req.query;
        try {
            let user = await User.findOne({ telegramId: Number(userId) });
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            
            // সময়টিকে সংখ্যায় (Timestamp) রূপান্তর করা হয়েছে যাতে টাইমার কাজ করে
            let lastTime = 0;
            if (user.lastMining) {
                lastTime = new Date(user.lastMining).getTime();
            }
            
            return res.status(200).json({
                balance: Number(user.balance) || 0,
                lastMining: Number(lastTime) || 0
            });
        } catch (e) {
            return res.status(500).json({ error: "Server Error" });
        }
    }

    // ২. মাইনিং ক্লেইম করার অংশ (POST Request)
    if (req.method === 'POST' && req.body.action === 'claim') {
        const { userId } = req.body;
        try {
            let user = await User.findOne({ telegramId: Number(userId) });
            if (!user) return res.status(404).json({ success: false });

            const now = new Date();
            const waitTime = 12 * 60 * 60 * 1000; // ১২ ঘণ্টা

            if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > waitTime)) {
                user.balance += 1000;
                user.lastMining = now;
                await user.save();
                return res.status(200).json({ 
                    success: true, 
                    balance: user.balance, 
                    lastMining: user.lastMining.getTime() 
                });
            }
            return res.status(400).json({ success: false, message: "Wait for timer" });
        } catch (e) {
            return res.status(500).json({ error: "Server Error" });
        }
    }

    // ৩. টেলিগ্রাম বটের মেসেজ প্রসেস করা
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } catch (e) { res.status(200).send('OK'); }
    } else {
        res.status(200).send('Nxracoin Engine is Running');
    }
};

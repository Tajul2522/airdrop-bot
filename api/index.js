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

// ডাটাবেজ মডেল
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true },
    lastMining: { type: Date, default: null }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// --- এডমিন কমান্ড ---
bot.command('reset', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await connectDB();
    await User.findOneAndUpdate({ telegramId: ADMIN_ID }, { lastMining: null });
    ctx.reply("✅ Admin: Timer reset successfully!");
});

// --- স্টার্ট কমান্ড ---
bot.start(async (ctx) => {
    try {
        await connectDB();
        const userId = ctx.from.id;
        const refId = ctx.payload;
        // ক্যাশ এবং NaN সমস্যা দূর করতে ভার্সন v=2.0 এবং টাইমস্ট্যাম্প যোগ করা হয়েছে
        const WEB_APP_URL = `https://airdrop-bot-nine.vercel.app/app.html?v=2.0&t=${Date.now()}`;

        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: ctx.from.username || 'User',
                referredBy: refId && Number(refId) !== userId ? Number(refId) : null
            });
            await user.save();
            if (user.referredBy) {
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 5000 } });
            }
        }

        ctx.replyWithMarkdown(`👋 *Welcome to Nxracoin Reward Bot!*`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)],
                [Markup.button.callback('💰 Balance', 'balance')]
            ])
        );
    } catch (e) { console.error(e); }
});

bot.action('balance', async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.reply(`💰 Balance: ${user ? user.balance : 0} Nxracoin`);
});

// --- ভার্সেল হ্যান্ডলার (সব এরর ফিক্স সহ) ---
module.exports = async (req, res) => {
    try {
        await connectDB();
        
        if (req.method === 'GET') {
            const { userId } = req.query;
            const id = Number(userId);
            if (!id || isNaN(id)) return res.status(200).json({ balance: 0, lastMining: 0 });
            
            const user = await User.findOne({ telegramId: id });
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            
            const lastTime = user.lastMining ? new Date(user.lastMining).getTime() : 0;
            return res.status(200).json({ balance: user.balance, lastMining: lastTime });
        }

        if (req.method === 'POST' && req.body.action === 'claim') {
            const id = Number(req.body.userId);
            const user = await User.findOne({ telegramId: id });
            const now = new Date();
            if (!user.lastMining || (now.getTime() - new Date(user.lastMining).getTime() > 12*60*60*1000)) {
                user.balance += 1000;
                user.lastMining = now;
                await user.save();
                return res.status(200).json({ success: true, balance: user.balance, lastMining: user.lastMining.getTime() });
            }
            return res.status(200).json({ success: false });
        }

        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        res.status(200).send('OK'); // টেলিগ্রামকে থামানোর জন্য সবসময় OK পাঠানো জরুরি
    }
};

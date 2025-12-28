const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ডাটাবেজ মডেল (৩ লক্ষ ইউজারের জন্য অপ্টিমাইজড)
const UserSchema = new mongoose.Schema({
    telegramId: { type: Number, unique: true, index: true },
    username: String,
    wallet: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// MongoDB কানেকশন
mongoose.connect(process.env.MONGO_URI);

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.payload; // রেফারেল চেক

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
                await User.findOneAndUpdate({ telegramId: user.referredBy }, { $inc: { balance: 10 } });
            }
        }
        
        ctx.reply(`স্বাগতম! ৩ লক্ষ ইউজারের বিশাল এয়ারড্রপে আপনি যোগ দিয়েছেন।`,
            Markup.inlineKeyboard([
                [Markup.button.callback('টাস্ক সম্পন্ন করুন', 'tasks')],
                [Markup.button.callback('ব্যালেন্স ও রেফার', 'balance')]
            ])
        );
    } catch (e) { console.log(e); }
});

bot.action('balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.reply(`আপনার ব্যালেন্স: ${user ? user.balance : 0} পয়েন্ট\nআপনার রেফারেল লিংক: ${refLink}`);
});

// Vercel Handler (বারবার মেসেজ আসা বন্ধ করতে এটি গুরুত্বপূর্ণ)
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK'); // টেলিগ্রামকে সাথে সাথে জানানো
        } catch (err) {
            console.error(err);
            res.status(200).send('OK'); // এরর হলেও টেলিগ্রামকে থামানো
        }
    } else {
        res.status(200).send('বট সচল আছে!');
    }
};

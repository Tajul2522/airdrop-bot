const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

// বটের টোকেন এবং ডাটাবেজ লিঙ্ক (এগুলো পরে Vercel ড্যাশবোর্ড থেকে দিতে হবে)
const bot = new Telegraf(process.env.BOT_TOKEN);

// ডাটাবেজ কানেকশন
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB Connected"))
  .catch(err => console.log(err));

// বটের মূল কাজ শুরু
bot.start((ctx) => {
    ctx.reply('স্বাগতম! আপনি আমাদের এয়ারড্রপে অংশ নিয়েছেন।');
});

// Vercel এর জন্য এক্সপোর্ট
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } else {
            res.status(200).send('Bot is working fine!');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error in bot');
    }
};

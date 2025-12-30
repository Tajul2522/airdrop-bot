// আপনার বর্তমান bot কোডের নিচে এটি যুক্ত করুন
bot.action('mining', (ctx) => {
    ctx.reply('⛏️ Start Daily Mining', 
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 Open Dashboard', `https://${process.env.VERCEL_URL}/app.html`)]
        ])
    );
});

// ওয়েব অ্যাপ থেকে 'Claim' বাটনের ডাটা রিসিভ করা
bot.on('web_app_data', async (ctx) => {
    const data = ctx.webAppData.data();
    if (data === "mining_success") {
        const userId = ctx.from.id;
        // ডাটাবেজে ব্যালেন্স আপডেট লজিক
        await User.findOneAndUpdate({ telegramId: userId }, { $inc: { balance: 1000 } });
        ctx.reply("✅ Success! 1000 Nxracoin added to your balance.");
    }
});

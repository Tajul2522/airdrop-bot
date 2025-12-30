bot.action('mining', (ctx) => {
    // আপনার দেওয়া ডোমেইন সরাসরি এখানে বসিয়ে দেওয়া হয়েছে
    const webAppUrl = "https://airdrop-bot-nine.vercel.app/app.html"; 
    
    ctx.reply('⛏️ *Nxracoin Mining Dashboard*', 
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 Open Mining App', webAppUrl)]
        ])
    );
});

// ওয়েব অ্যাপ থেকে ডাটা রিসিভ করার লজিক
bot.on('web_app_data', async (ctx) => {
    if (ctx.webAppData.data() === "mining_success") {
        const userId = ctx.from.id;
        const user = await User.findOne({ telegramId: userId });
        
        // ১২ ঘণ্টা পর পর মাইনিং করার লজিক এখানে যুক্ত করুন
        user.balance += 1000;
        await user.save();
        
        ctx.reply(`✅ Success! 1000 Nxracoin added.\nTotal Balance: ${user.balance}`);
    }
});

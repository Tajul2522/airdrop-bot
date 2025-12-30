bot.action('mining', (ctx) => {
    // এখানে আপনার Vercel ডোমেইন সরাসরি লিখে দিন (যেমন: https://your-bot.vercel.app/app.html)
    const webAppUrl = "https://আপনার-প্রজেক্ট-নাম.vercel.app/app.html"; 
    
    ctx.reply('⛏️ Start Daily Mining', 
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 Open Dashboard', webAppUrl)]
        ])
    );
});

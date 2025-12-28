// আপনার আসল ভার্সেল লিঙ্কটি এখানে দিন
const WEB_APP_URL = 'https://airdrop-bot-nine.vercel.app/mining.html';

ctx.replyWithMarkdown(welcomeMsg, 
    Markup.inlineKeyboard([
        [Markup.button.webApp('⛏️ Start Daily Mining', WEB_APP_URL)], // সরাসরি লিঙ্কটি বসান
        [
            Markup.button.callback('📝 Start/Complete Task', 'tasks'),
            Markup.button.callback('🎁 Daily Bonus', 'bonus')
        ],
        [
            Markup.button.callback('💳 Withdraw', 'withdraw'),
            Markup.button.callback('💰 Your Balance', 'balance')
        ],
        [Markup.button.callback('☎️ Support', 'support')]
    ])
);

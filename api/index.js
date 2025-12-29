// আপনার api/index.js এর GET অংশটি এভাবে আপডেট করুন:

    if (req.method === 'GET') {
        const { userId } = req.query;
        if (!userId || userId === "0") {
            return res.status(200).json({ balance: 0, lastMining: 0 });
        }
        try {
            // ডাটাবেজ কানেকশন চেক
            if (mongoose.connection.readyState !== 1) {
                await mongoose.connect(process.env.MONGO_URI);
            }
            
            let user = await User.findOne({ telegramId: Number(userId) });
            if (!user) return res.status(200).json({ balance: 0, lastMining: 0 });
            
            const lastTime = user.lastMining ? new Date(user.lastMining).getTime() : 0;
            return res.status(200).json({ balance: user.balance, lastMining: lastTime });
        } catch (e) { 
            // আসল এররটি লগে প্রিন্ট হবে
            console.error("Database Fetch Error:", e.message);
            return res.status(500).json({ error: "DB Connection Error", details: e.message }); 
        }
    }

const mongoose = require('mongoose');

// আপনার কপি করা লিঙ্কটি এখানে দিন
const dbURI = "mongodb+srv://mybotuser121:YnVf2Bl4gktHEi4M@cluster0.7tafvi7.mongodb.net/?appName=Cluster0";

mongoose.connect(dbURI)
  .then(() => console.log("ডাটাবেজ কানেক্ট হয়েছে!"))
  .catch((err) => console.log("কানেকশনে ভুল হয়েছে:", err));
const mongoose = require('mongoose');

// ইউজারের তথ্যের জন্য একটি ছক বা Schema তৈরি করা
const UserSchema = new mongoose.Schema({
    telegramId: { 
        type: Number, 
        required: true, 
        unique: true, // এটি নিশ্চিত করবে যে একই আইডি দুইবার সেভ হবে না
        index: true   // এটি ৩ লক্ষ ইউজারের মধ্যে আইডি খুঁজতে গতি বাড়িয়ে দিবে
    },
    username: String,
    wallet: String,
    balance: { type: Number, default: 0 },
    referredBy: { type: Number, index: true }, // রেফারেল দ্রুত চেক করার জন্য এটিও ইনডেক্স করা ভালো
    isJoined: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// এই মডেলটি এক্সপোর্ট করা যাতে অন্য ফাইল থেকে ব্যবহার করা যায়
module.exports = mongoose.model('User', UserSchema);

const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Helper script to get bot information and group chat ID
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function getBotInfo() {
    try {
        console.log('🔍 Getting bot information...');
        
        // Get bot info
        const botInfo = await bot.getMe();
        console.log('🤖 Bot Information:');
        console.log(`   Name: ${botInfo.first_name}`);
        console.log(`   Username: @${botInfo.username}`);
        console.log(`   ID: ${botInfo.id}`);
        
        console.log('\n📱 Getting recent updates...');
        
        // Get recent updates to find chat ID
        const updates = await bot.getUpdates({ limit: 10, offset: -1 });
        
        if (updates.length === 0) {
            console.log('\n❌ No recent updates found.');
            console.log('💡 Make sure to:');
            console.log('   1. Add your bot to the target group');
            console.log('   2. Send a message to the group');
            console.log('   3. Try this script again');
            return;
        }
        
        console.log(`\n📨 Found ${updates.length} recent update(s):`);
        
        const chats = new Set();
        
        updates.forEach((update, index) => {
            if (update.message) {
                const chat = update.message.chat;
                const from = update.message.from;
                
                if (!chats.has(chat.id)) {
                    chats.add(chat.id);
                    
                    const chatType = chat.type === 'private' ? 'Private' : 
                                   chat.type === 'group' ? 'Group' : 
                                   chat.type === 'supergroup' ? 'SuperGroup' : 'Channel';
                    
                    console.log(`\n📍 Update ${index + 1}:`);
                    console.log(`   Type: ${chatType}`);
                    console.log(`   ID: ${chat.id}`);
                    console.log(`   Title: ${chat.title || chat.first_name || 'N/A'}`);
                    console.log(`   From: ${from.first_name || from.username || 'N/A'}`);
                    
                    if (chat.type !== 'private') {
                        console.log(`   ✅ USE THIS CHAT ID: ${chat.id}`);
                    }
                }
            }
        });
        
        console.log('\n🎯 Setup Instructions:');
        console.log('1. Copy the chat ID marked ✅ above');
        console.log('2. Add it to your .env file as:');
        console.log(`   GROUP_CHAT_ID=${Array.from(chats).find(id => id < 0) || 'YOUR_CHAT_ID'}`);
        console.log('3. Restart your bot');
        
    } catch (error) {
        console.error('❌ Error getting bot information:', error.message);
        
        if (error.message.includes('Unauthorized')) {
            console.log('\n💡 Make sure your TELEGRAM_BOT_TOKEN is correct in .env file');
        }
    }
}

console.log('🚀 Chat ID Finder Script');
console.log('========================\n');
getBotInfo();
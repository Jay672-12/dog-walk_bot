# Installation and Setup Guide

## Prerequisites
- Node.js (version 14 or higher)
- npm package manager
- Telegram Bot Token from @BotFather

## Step 1: Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "Dog Walk Tracker")
4. Choose a username (e.g., "dogwalk_tracker_bot")
5. Copy the **BOT TOKEN** provided by BotFather

## Step 2: Get Group Chat ID

### Method 1: Using @RawDataBot (Easiest)

1. Add your bot to the target group
2. Also add **@RawDataBot** to the same group
3. Send any message to the group
4. @RawDataBot will reply with JSON data
5. Find the `"chat":{"id":CHAT_ID}` field (negative number for groups)
6. Copy the **CHAT_ID** value

### Method 2: Using Web API (Technical)

1. Add your bot to the target group
2. Send any message to the group
3. Send a direct message to your bot: `/start`
4. Now visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Look for `"chat":{"id":CHAT_ID}` in the response
6. Copy the **CHAT_ID** value

### Method 3: Using @userinfobot (Alternative)

1. Add your bot and **@userinfobot** to the group
2. Send any message to the group
3. @userinfobot will reply with user information
4. Look for the group chat ID in the response

### What to Look For:
```json
{
  "message": {
    "chat": {
      "id": -1001234567890,  // <- This is your GROUP_CHAT_ID
      "title": "Your Group Name"
    }
  }
}
```

### Important Notes:
- Group chat IDs are **negative numbers** (e.g., -100123456789)
- Private chat IDs are **positive numbers**
- You must send a message to the group first for the bot to receive updates
- The bot needs permission to read messages in the group

## Step 3: Get Chat ID (Easier Method)

### Option A: Automated Script (Recommended)
1. Setup your `.env` file with just your bot token:
   ```
   TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
   GROUP_CHAT_ID=will_be_filled_later
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run chat ID finder:
   ```bash
   npm run get-chatid
   ```
4. Add your bot to the target group
5. Send any message to the group
6. Run the script again - it will show all chat IDs
7. Copy the **group chat ID** (negative number) to your `.env`

### Option B: Manual @RawDataBot
1. Add your bot to the target group
2. Also add **@RawDataBot** to the same group
3. Send any message to the group
4. @RawDataBot will reply with JSON data
5. Find the `"chat":{"id":CHAT_ID}` field (negative number for groups)
6. Copy the **CHAT_ID** value

## Step 4: Complete Setup

1. Complete your `.env` file with both values:
   ```
   TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
   GROUP_CHAT_ID=-1234567890 (from Step 3)
   ```
2. Install dependencies (if not done):
   ```bash
   npm install
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
5. Edit `.env` file and add your credentials:
   ```
   TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
   GROUP_CHAT_ID=your_actual_chat_id_here
   ```

## Step 4: Run the Bot

### Development (with auto-restart):
```bash
npm run dev
```

### Production:
```bash
npm start
```

## Step 5: Test the Bot

1. Add the bot to your Telegram group
2. Make sure it has permission to send messages
3. Try the commands:
   - `/dogwalk` - Should log a walk and show summary
   - `/summary` - Should show today's walks
   - `/help` - Should show available commands

## Example Usage

1. User types: `/dogwalk`
2. Bot responds: `31012026`
3. Bot adds: `Walk 1: 0915`
4. User types: `/dogwalk` again
5. Bot **edits** the message to: 
   ```
   31012026
   Walk 1: 0915
   Walk 2: 1045
   ```

## Features

✅ **Auto Message Chaining**: Same day walks edit the same message
✅ **Daily Reset**: New day creates new message
✅ **Persistent Storage**: Data survives bot restarts
✅ **Error Handling**: Graceful error recovery
✅ **Timezone Support**: Configurable timezone handling
✅ **Group Support**: Works in group chats
✅ **Daily Summary**: Automatic final summary at midnight

## Troubleshooting

### Bot doesn't respond:
- Check if bot token is correct
- Verify bot is in the group
- Ensure bot has message permissions

### Can't find Group Chat ID:
- Make sure bot token is correct in the URL
- Check that the bot has received messages from the group
- Try sending a new message to the group and check updates again

### Data not saving:
- Check file permissions in the bot directory
- Ensure the bot process has write access
- Check console for error messages

### Message not updating:
- Wait a few seconds between /dogwalk commands
- Check if bot has permission to edit messages
- Verify the date format is correct

## Security Notes

- Never share your bot token publicly
- Keep the `.env` file private
- Use a read-only file system in production
- Consider adding rate limiting for large groups
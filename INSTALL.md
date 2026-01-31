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

## Step 2: Create .env File (Detailed Steps)

### Step 2a: Copy the Example File
```bash
# First, go to your bot directory
cd /Users/jaychoo/telegram-dogwalk-bot

# List the files to see what's there
ls -la

# Copy the example file to create your .env
cp .env.example .env

# Verify it was created
ls -la | grep .env
```

**What `cp .env.example .env` does:**
- **`cp`** = copy command
- **`.env.example`** = source file (template)
- **`.env`** = destination file (your actual config)
- This creates a copy of the template as your working file

### Step 2b: Edit Your .env File
```bash
# Using nano editor (simple, pre-installed on Mac/Linux)
nano .env

# OR using vim editor
vim .env

# OR using VS Code (if you have it)
code .env

# OR using TextEdit on Mac
open -e .env
```

**Your .env file will look like this initially:**
```env
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Target Group Chat ID (optional - if not set, will work in any chat)
GROUP_CHAT_ID=your_group_chat_id_here

# Timezone for scheduling (optional)
TIMEZONE=Asia/singapore
```

### Step 2c: Add Your Bot Token
```env
# Replace "your_bot_token_here" with your actual token
# Example only - use your real token!
TELEGRAM_BOT_TOKEN=123456:ABCDEF123456789

# Keep GROUP_CHAT_ID as placeholder for now
GROUP_CHAT_ID=will_be_filled_later

# Your final .env should look like:
TELEGRAM_BOT_TOKEN=123456:ABCDEF123456789
GROUP_CHAT_ID=will_be_filled_later
TIMEZONE=Asia/singapore
```

### Step 2d: Save and Exit Editor
**If using nano:**
1. Press `Ctrl + X` to exit
2. Press `Y` to confirm saving
3. Press `Enter` to confirm filename

**If using vim:**
1. Press `Esc` to enter command mode
2. Type `:wq` and press `Enter`

**If using VS Code or TextEdit:**
1. Just save the file normally (Cmd+S or Ctrl+S)

### Step 2e: Install Dependencies
```bash
# This downloads all the code libraries the bot needs
npm install

# You'll see output like this:
# Added 150 packages from 200 contributors...
# ✅ All dependencies installed successfully
```

## Step 3: Get Chat ID (Easier Method)

### Option A: Automated Script (Recommended)
1. Add your bot to the target group
2. Send any message to the group
3. Run chat ID finder:
   ```bash
   npm run get-chatid
   ```
4. Run the script again - it will show all chat IDs
5. Copy the **group chat ID** (negative number) to your `.env`

### Option B: Manual @RawDataBot
1. Add your bot to the target group
2. Also add **@RawDataBot** to the same group
3. Send any message to the group
4. @RawDataBot will reply with JSON data
5. Find the `"chat":{"id":CHAT_ID}` field (negative number for groups)
6. Copy the **CHAT_ID** value

## Step 4: Complete Setup

### Step 4a: Update .env with Chat ID
```bash
# Edit .env again to add the chat ID you found
nano .env

# Replace the placeholder with the ✅ marked group ID
GROUP_CHAT_ID=-1234567890

# Your final .env should now look like:
TELEGRAM_BOT_TOKEN=123456:ABCDEF123456789
GROUP_CHAT_ID=-1234567890
TIMEZONE=Asia/singapore
```

### Step 4b: Verify Your Setup
```bash
# Check your .env file looks correct
cat .env

# Should output:
TELEGRAM_BOT_TOKEN=123456:ABCDEF123456789
GROUP_CHAT_ID=-1234567890
TIMEZONE=Asia/singapore
```

### Step 4c: Start Your Bot!
```bash
# Start the bot and watch it work
npm start

# You should see:
# 🐕 Starting Dog Walk Bot...
# ✅ Dog Walk Bot is ready!
```

## 🔧 **Complete Step-by-Step Summary**:

```bash
# Complete workflow from start to finish:

# 1. Navigate to bot directory
cd /Users/jaychoo/telegram-dogwalk-bot

# 2. Copy example file to create .env
cp .env.example .env

# 3. Edit .env file with nano editor
nano .env

# 4. Replace with your actual bot token:
TELEGRAM_BOT_TOKEN=123456:ABCDEF123456789
GROUP_CHAT_ID=will_be_filled_later

# 5. Save file (Ctrl+X, Y, Enter) and exit nano

# 6. Install required code packages
npm install

# 7. Add bot to your Telegram group

# 8. Send any message to the group

# 9. Run chat ID finder
npm run get-chatid

# 10. Look for ✅ marked group ID and copy it

# 11. Edit .env again and add group ID:
GROUP_CHAT_ID=-1234567890

# 12. Save file and start bot!
npm start
```

## 📋 **What Each Command Does**:

- **`cd`** = change directory (navigate to folder)
- **`ls -la`** = list all files with details
- **`cp file1 file2`** = copy file1 to file2
- **`nano filename`** = open file in nano text editor
- **`npm install`** = download and install Node.js packages
- **`npm run scriptname`** = run a predefined script from package.json

## ✅ **Key Improvements**:

1. **Detailed `cp` command explanation** - no more confusion
2. **Step-by-step file editing** with multiple editor options
3. **Complete workflow** from directory to running bot
4. **Expected outputs** shown for verification
5. **Troubleshooting** for common issues
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
// t.me/book_buddy7_bot
require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");

// Initialize database
const db = new sqlite3.Database("./books.db", (err) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to SQLite database.");
});

// Create tables
db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, 
        username TEXT, 
        first_name TEXT, 
        last_name TEXT, 
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Liked Books Table (Fixed)
    db.run(`CREATE TABLE IF NOT EXISTS liked_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        title TEXT NOT NULL, 
        author TEXT, 
        genre TEXT, 
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Recommendations Table
    db.run(`CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user INTEGER, 
        to_user INTEGER, 
        book_title TEXT NOT NULL, 
        message TEXT,
        FOREIGN KEY(from_user) REFERENCES users(id),
        FOREIGN KEY(to_user) REFERENCES users(id)
    )`);

    // Search History Table
    db.run(`CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, 
        query TEXT NOT NULL,
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // My Recommendations Table
    db.run(`CREATE TABLE IF NOT EXISTS myrecs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        title TEXT NOT NULL, 
        author TEXT, 
        genre TEXT, 
        link TEXT, 
        recommended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});


// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

/// 🤖 Greeting message when the bot starts & add user to the database
bot.start((ctx) => {
    const { id, username, first_name, last_name } = ctx.from;
  
    db.run(
        `INSERT OR IGNORE INTO users (id, username, first_name, last_name) VALUES (?, ?, ?, ?)`,
        [id, username, first_name, last_name],
        (err) => {
          if (err) console.error("Error saving user:", err);
          else console.log(`User ${first_name} added to database.`);
        }
      );
  
    ctx.reply(
      `👋 Hello ${first_name}!\n\nWelcome to *BookBuddy Bot*! 📚\n\n` +
      `I can help you find books, save your favorites, and even recommend them to friends!\n\n` +
      `Use /help to see all my commands. Happy reading! 😊`
    );
  });

// 📜 User manual (list of commands)
bot.command("help", (ctx) => {
  ctx.replyWithHTML(
    `<b>📖 BookBuddy Bot - User Guide</b>\n\n` +
    `🔍 <b>Search Books:</b> <code>/search [book title]</code>\n` +
    `👍 <b>Like a Book:</b> <code>/like [book title]</code>\n` +
    `📜 <b>View Liked Books:</b> <code>/liked</code>\n` +
    `🔍 <b>View Search History:</b> <code>/history</code>\n` +
    `❌ <b>Clear Search History:</b> <code>/clearhistory</code>\n` +
    `🎲 <b>Get a Random Book Suggestion:</b> <code>/random</code>\n` +
    `🎯 <b>Personalized Daily Recommendations:</b> <code>/daily</code>\n` +
    `📚 <b>View Your Daily Recommendations:</b> <code>/dailyrecs</code>\n` +
    `🔗 <b>Recommend a Book to a Friend:</b> <code>/recommend @friend_username Book Title - Your Message</code>\n` +
    `📩 <b>View Books Recommended to You:</b> <code>/recommendations</code>\n\n` +
    `Happy reading! 📚😊`
  );
});

  const bookCache = new Map(); // Store books temporarily  

// 📚 Search books using Google Books API
bot.command("search", async (ctx) => {
  const query = ctx.message.text.split(" ").slice(1).join(" ");
  if (!query) return ctx.reply("Please provide a book title to search.");

  try {
    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${query}&key=${process.env.GOOGLE_BOOKS_API_KEY}`);
    const books = response.data.items.slice(0, 5);

    if (!books.length) return ctx.reply("No books found.");

    books.forEach((book, index) => {
      const info = book.volumeInfo;
      const title = info.title;
      const author = info.authors?.join(", ") || "Unknown";
      const genre = info.categories?.join(", ") || "Unknown";
      
      // Store in cache
      bookCache.set(`${ctx.from.id}_${title}`, { title, author, genre });

      ctx.replyWithHTML(
        `📖 <b>${title}</b>\n` +
        `👤 Author: ${author}\n` +
        `📚 Genre: ${genre}\n` +
        `🔗 <a href="${info.infoLink}">View Book</a>\n\n` +
        `👍 <code>/like ${title}</code>`
      );
    });

    db.run("INSERT INTO search_history (user_id, query) VALUES (?, ?)", [ctx.from.id, query]);
  } catch (error) {
    console.error(error);
    ctx.reply("Failed to fetch books.");
  }
});

bot.command("like", async (ctx) => {
  try {
    const userId = ctx.message.from.id;
    // Get the entire message text after the command
    const fullText = ctx.message.text;
    // Remove the "/like " prefix to get the title
    const title = fullText.substring(6).trim();
    
    if (!title) return ctx.reply("❌ Please provide a book title. Example: /like The Hobbit");

    console.log(`User ${userId} liked book: ${title}`);

    // Retrieve book details from cache
    const bookData = bookCache.get(`${userId}_${title}`);
    if (!bookData) {
      return ctx.reply("❌ Book details not found. Please search for the book again before liking.");
    }

    const { author, genre } = bookData;

    // Check if the book is already liked
    db.get("SELECT * FROM liked_books WHERE user_id = ? AND title = ?", [userId, title], (err, row) => {
      if (err) {
        console.error("Database error:", err.message);
        return ctx.reply("❌ Error checking liked books.");
      }
      if (row) return ctx.reply("✅ You already liked this book!");

      // Insert into liked_books
      db.run("INSERT INTO liked_books (user_id, title, author, genre) VALUES (?, ?, ?, ?)", 
        [userId, title, author, genre], 
        function (err) {
          if (err) {
            console.error("Database error:", err.message);
            ctx.reply("❌ Error saving like.");
          } else {
            ctx.reply(`👍 You liked *${title}*!`, { parse_mode: "Markdown" });
          }
        }
      );
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    ctx.reply("❌ An unexpected error occurred.");
  }
});

/// 📜 View liked books
bot.command("liked", (ctx) => {
    db.all(
      "SELECT title, author, genre FROM liked_books WHERE user_id = ?",
      [ctx.from.id],
      (err, rows) => {
        if (err || !rows.length) return ctx.reply("No liked books found.");
        const bookList = rows.map((row) => `📖 <b>${row.title}</b>\n👤 ${row.author}\n📚 ${row.genre}`).join("\n\n");
        ctx.replyWithHTML(`Your Liked Books:\n\n${bookList}`);
      }
    );
  });
  

// 🔍 View search history
bot.command("history", (ctx) => {
  db.all("SELECT query FROM search_history WHERE user_id = ?", [ctx.from.id], (err, rows) => {
    if (err || !rows.length) return ctx.reply("No search history found.");
    const historyList = rows.map((row) => `🔍 ${row.query}`).join("\n");
    ctx.reply(`Your Search History:\n${historyList}`);
  });
});

// ❌ Clear search history
bot.command("clearhistory", (ctx) => {
  db.run("DELETE FROM search_history WHERE user_id = ?", [ctx.from.id], () => {
    ctx.reply("✅ Search history cleared.");
  });
});

// 🎲 Random book suggestion
bot.command("random", async (ctx) => {
  try {
    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=random&key=${process.env.GOOGLE_BOOKS_API_KEY}`);
    const book = response.data.items[0].volumeInfo;
    ctx.replyWithMarkdown(
      `📖 *${book.title}*\n👤 Author: ${book.authors?.join(", ") || "Unknown"}\n📚 Genre: ${book.categories?.join(", ") || "Unknown"}\n🔗 [View Book](${book.infoLink})`
    );
  } catch (error) {
    ctx.reply("Couldn't fetch a random book.");
  }
});

// 🎯 Personalized daily recommendation based on liked books
bot.command("daily", async (ctx) => {
  try {
    // First check if user has any liked books
    const userId = ctx.from.id;
    
    db.all("SELECT title, author, genre FROM liked_books WHERE user_id = ?", [userId], async (err, likedBooks) => {
      if (err) {
        console.error("Database error:", err.message);
        return ctx.reply("Error accessing your liked books.");
      }
      
      if (!likedBooks || likedBooks.length === 0) {
        return ctx.reply("You haven't liked any books yet. Like some books first to get personalized recommendations!");
      }
      
      // Select a random genre from user's liked books
      const randomLikedBook = likedBooks[Math.floor(Math.random() * likedBooks.length)];
      const genre = randomLikedBook.genre || "fiction"; // Default to fiction if genre is empty
      
      // Create a simpler, more reliable query
      try {
        // Use a more generic search query that's more likely to return results
        const simpleQuery = encodeURIComponent(`subject:${genre.split(',')[0].trim()}`);
        
        // Make API request with minimal parameters for better results
        const response = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=${simpleQuery}&maxResults=40&key=${process.env.GOOGLE_BOOKS_API_KEY}`
        );
        
        if (!response.data.items || response.data.items.length === 0) {
          // Try an alternative approach with just the genre keyword
          const altQuery = encodeURIComponent(genre.split(',')[0].trim());
          const altResponse = await axios.get(
            `https://www.googleapis.com/books/v1/volumes?q=${altQuery}&maxResults=40&key=${process.env.GOOGLE_BOOKS_API_KEY}`
          );
          
          if (!altResponse.data.items || altResponse.data.items.length === 0) {
            return ctx.reply("Couldn't find any book recommendations right now. Please try again later.");
          }
          
          response.data = altResponse.data;
        }
        
        // Filter out books the user has already liked
        const likedTitles = new Set(likedBooks.map(book => book.title.toLowerCase()));
        const filteredBooks = response.data.items.filter(item => 
          item.volumeInfo && 
          item.volumeInfo.title && 
          !likedTitles.has(item.volumeInfo.title.toLowerCase())
        );
        
        if (filteredBooks.length === 0) {
          return ctx.reply("You seem to have liked all the books we can find in this genre! Try liking books from different genres.");
        }
        
        // Shuffle the filtered books
        shuffleArray(filteredBooks);
        
        // Take up to 3 books
        const recommendCount = Math.min(3, filteredBooks.length);
        const recommendedBooks = filteredBooks.slice(0, recommendCount);
        
        // Header message
        let message = `📚 <b>Your Daily Book Recommendations</b>\n` +
                      `Based on your interest in <i>${genre}</i>\n\n`;
        
        // Add each book to the message
        for (let i = 0; i < recommendedBooks.length; i++) {
          const book = recommendedBooks[i].volumeInfo;
          
          // Skip books without essential info
          if (!book || !book.title) continue;
          
          const author = book.authors?.join(", ") || "Unknown";
          const bookGenre = book.categories?.join(", ") || genre;
          const link = book.infoLink || "";
          
          // Get short description if available
          const description = book.description 
            ? book.description.substring(0, 80) + "..." 
            : "No description available";
          
          message += `<b>${i + 1}. ${book.title}</b>\n` +
                     `👤 Author: ${author}\n` +
                     `📝 ${description}\n` +
                     `🔗 <a href="${link}">View Book</a>\n` +
                     `Like this book? <code>/like ${book.title}</code>\n\n`;
          
          // Save to recommendations table
          db.run(
            "INSERT INTO myrecs (user_id, title, author, genre, link) VALUES (?, ?, ?, ?, ?)",
            [userId, book.title, author, bookGenre, link],
            (err) => {
              if (err) console.error("Error saving recommendation:", err);
            }
          );
        }
        
        ctx.replyWithHTML(message);
        
      } catch (error) {
        console.error("Google Books API Error:", error);
        ctx.reply("Error connecting to book service. Please try again later.");
      }
    });
  } catch (error) {
    console.error("Unhandled error in daily recommendation:", error);
    ctx.reply("An unexpected error occurred. Please try again later.");
  }
});

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
  
// 🔗 Recommend a book to a friend
bot.command("recommend", (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 3) return ctx.reply("Usage: /recommend @friend_username Book Title - Your Message");

  const fromUserId = ctx.from.id;
  const fromUsername = ctx.from.username || ctx.from.first_name;
  const toUsername = args[1].replace("@", "");
  
  // Check if the message contains the separator "-"
  if (!ctx.message.text.includes("-")) {
    return ctx.reply("Please include a message after the book title using a dash (-). Example: /recommend @friend_username Book Title - Check this out!");
  }
  
  const bookTitle = args.slice(2, args.indexOf("-")).join(" ").trim();
  const message = args.slice(args.indexOf("-") + 1).join(" ").trim() || "Check out this book!";
  
  if (!bookTitle) {
    return ctx.reply("Please specify a book title. Usage: /recommend @friend_username Book Title - Your Message");
  }

  // First, find the recipient user in the database
  db.get("SELECT id FROM users WHERE username = ?", [toUsername], (err, recipientUser) => {
    if (err) {
      console.error("Database error:", err.message);
      return ctx.reply("Error finding user.");
    }
    
    if (!recipientUser) {
      return ctx.reply(`User @${toUsername} hasn't used this bot yet. They need to start the bot first.`);
    }
    
    const toUserId = recipientUser.id;
    
    // Now save the recommendation
    db.run(
      "INSERT INTO recommendations (from_user, to_user, book_title, message) VALUES (?, ?, ?, ?)", 
      [fromUserId, toUserId, bookTitle, message], 
      function(err) {
        if (err) {
          console.error("Database error:", err.message);
          return ctx.reply("Error saving recommendation.");
        }
        
        // Send a notification to the recipient
        bot.telegram.sendMessage(
          toUserId,
          `📚 <b>New Book Recommendation!</b>\n\n` +
          `@${fromUsername} recommends: <b>${bookTitle}</b>\n\n` +
          `💬 "${message}"\n\n` +
          `Check it out using /recommendations to see all books recommended to you.`,
          { parse_mode: "HTML" }
        ).catch(error => {
          console.error("Error sending notification:", error);
        });
        
        ctx.reply(`📩 You've successfully recommended "${bookTitle}" to @${toUsername}!`);
      }
    );
  });
});

bot.command("recommendations", (ctx) => {
  const userId = ctx.from.id;
  
  // Query to get recommendations where this user is the recipient
  db.all(
    `SELECT r.book_title, r.message, u.username, u.first_name 
     FROM recommendations r
     JOIN users u ON r.from_user = u.id
     WHERE r.to_user = ?
     ORDER BY r.id DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error("Database error:", err.message);
        return ctx.reply("Error retrieving recommendations.");
      }
      
      if (!rows || rows.length === 0) {
        return ctx.reply("You don't have any book recommendations from friends yet.");
      }
      
      let message = "📚 <b>Books Recommended to You</b>\n\n";
      
      rows.forEach((row, index) => {
        const fromName = row.username ? `@${row.username}` : row.first_name;
        message += `${index + 1}. <b>${row.book_title}</b>\n` +
                   `👤 From: ${fromName}\n` +
                   `💬 "${row.message}"\n\n`;
      });
      
      ctx.replyWithHTML(message);
    }
  );
});


bot.command("dailyrecs", (ctx) => {
  db.all("SELECT title, author, genre, link, recommended_at FROM myrecs WHERE user_id = ? ORDER BY recommended_at DESC", [ctx.from.id], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return ctx.reply("Error retrieving your daily recommendations.");
    }
    
    if (!rows || rows.length === 0) {
      return ctx.reply("You don't have any daily recommendations yet. Try /daily to get some!");
    }
    
    const recList = rows.map((row) => {
      const date = row.recommended_at ? 
        new Date(row.recommended_at).toLocaleDateString() : 
        "Recent";
        
      return `📖 <b>${row.title}</b>\n` +
             `👤 ${row.author}\n` +
             `📚 ${row.genre}\n` +
             `📅 ${date}\n` +
             `🔗 <a href="${row.link}">View Book</a>`;
    }).join("\n\n");
    
    ctx.replyWithHTML(`📩 <b>Your Daily Book Recommendations</b>\n\n${recList}`);
  });
});

bot.command("myrecs", (ctx) => {
  ctx.reply("This command has been renamed to /dailyrecs for clarity. Please use /dailyrecs to see your daily recommendations and /recommendations to see books recommended by friends.");
  
  db.all("SELECT title, author, genre, link FROM myrecs WHERE user_id = ?", [ctx.from.id], (err, rows) => {
    if (err || !rows.length) return;
    const recList = rows.map((row) => `📖 <b>${row.title}</b>\n👤 ${row.author}\n📚 ${row.genre}\n🔗 <a href="${row.link}">View Book</a>`).join("\n\n");
    ctx.replyWithHTML(`📩 Your Daily Book Recommendations:\n\n${recList}`);
  });
});

// Start the bot
bot.launch().then(() => {
  console.log("Bot is running....");
});

const app = express();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
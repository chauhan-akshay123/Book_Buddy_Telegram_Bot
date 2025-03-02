# **Book Bbuddy Telegram Bot**

A Telegram bot that allows users to search for books, like their favorites, receive personalized recommendations, track search history, and share book suggestions with friends.

## **Features**

✅ **Book Search**: Search for books by title, author, or keywords using Google Books API.  
✅ **Like Books**: Mark books as liked to improve recommendations.  
✅ **Personalized Recommendations**: Get daily book recommendations based on your preferences.  
✅ **Search History Tracking**: View and manage your past searches.  
✅ **Clear Search History**: Users can clear their search history.
✅ **Random Book Suggestion**: Users can get rancom book suggestion.
✅ **Book Details**: Get title, author, description, and purchase link for each book.  
✅ **Send Recommendations to Friends**: Share book recommendations with Telegram contacts. (contacts must be user of this bot) 
✅ **Clear Search History**: Remove past searches when needed.  
✅ **Interactive Buttons**: Quick actions for liking books and viewing recommendations.  

## **Tech Stack**

- **Node.js** – Backend for bot logic
- **Telegraf.js** – Telegram Bot API wrapper
- **SQLite3** – Local database for storing user interactions
- **Google Books API** – Fetching book details
- **Render** – Cloud hosting platform

## **Installation**

### **1. Clone the repository**
```sh
git clone https://github.com/yourusername/book-bot.git
cd book-bot
```

### **2. Install dependencies**
```sh
npm install
```

### **3. Set up environment variables**
Create a `.env` file and add:
```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
```

### **4. Start the bot**
```sh
node index.js
```

## **Database Design**

The bot uses an SQLite database with four main tables:

### **Users Table**
Stores Telegram user details.
```sql
users (
  user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### **Books Table**
Stores books fetched from Google Books API.
```sql
books (
  book_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  link TEXT
)
```

### **Liked Books Table**
Tracks books liked by users for personalized recommendations.
```sql
liked_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  book_id TEXT REFERENCES books(book_id) ON DELETE CASCADE,
  liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### **Search History Table**
Logs user search history.
```sql
search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## **Table Associations**

| Table                      | Association | Relationship                                                              |
|----------------------------|-------------|---------------------------------------------------------------------------|
| **Users ↔ Liked Books**    | One-to-Many | A user can like multiple books, but each liked entry belongs to one user. |
| **Users ↔ Search History** | One-to-Many | A user can have multiple search history entries.                          |
| **Books ↔ Liked Books**    | One-to-Many | A book can be liked by multiple users.                                    |

## **Deployment on Render**

### **1. Push Code to GitHub**
```sh
git add .
git commit -m "Initial commit"
git push origin main
```

### **2. Deploy to Render**
1. Go to [Render.com](https://render.com/)
2. Click **"New Web Service"** → Select **"Deploy from GitHub"**
3. Choose your repository and set **Start Command** as:
   ```sh
   node index.js
   ```
4. Add environment variables (**TELEGRAM_BOT_TOKEN** and **GOOGLE_BOOKS_API_KEY**)
5. Click **"Create Web Service"**

### **3. Keep Bot Running**
Enable "Keep Alive" in Render settings to prevent auto shutdown.

## **Usage**

- Start the bot by sending `/start`
- Search for a book using `/search <book name>`
- Like a book using `/like <book title>`
- View recommendations using `/recommend`
- Check search history with `/history`
- Clear search history using `/clearhistory`
- Share recommendations with friends via Telegram

## **Contributing**
Feel free to fork this repo, create pull requests, and report issues!

---

**Made with ❤️ for book lovers! 📚**


import aiosqlite
import logging

DB_NAME = "bot.db"

async def create_tables():
    async with aiosqlite.connect(DB_NAME) as db:
        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                username TEXT,
                language TEXT,
                session_string TEXT,
                status TEXT DEFAULT 'active',
                phone TEXT,
                role TEXT DEFAULT 'client',
                rating REAL DEFAULT 5.0,
                deals_count INTEGER DEFAULT 0
            )
        """)
        
        # Verification codes table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS verification_codes (
                phone TEXT PRIMARY KEY,
                code TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Templates table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                content TEXT,
                media_type TEXT,
                caption TEXT,
                entities TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                template_id INTEGER,
                target_groups TEXT, -- JSON list of group IDs
                run_time TEXT,
                start_time TEXT,
                end_time TEXT,
                interval_minutes INTEGER,
                last_run TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(template_id) REFERENCES templates(id)
            )
        """)
        # миграция для старых таблиц без новых колонок
        await _ensure_column(db, "scheduled_tasks", "start_time", "TEXT")
        await _ensure_column(db, "scheduled_tasks", "end_time", "TEXT")
        await _ensure_column(db, "scheduled_tasks", "interval_minutes", "INTEGER")
        await _ensure_column(db, "scheduled_tasks", "last_run", "TIMESTAMP")
        await _ensure_column(db, "scheduled_tasks", "is_active", "BOOLEAN DEFAULT 1")
        
        # Migration for templates
        await _ensure_column(db, "templates", "caption", "TEXT")
        await _ensure_column(db, "templates", "entities", "TEXT")
        await _ensure_column(db, "templates", "name", "TEXT")
        await _ensure_column(db, "users", "display_name", "TEXT")
        await _ensure_column(db, "users", "username", "TEXT")
        
        # Market rates table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS market_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_pair TEXT,
                rate_buy REAL,
                rate_sell REAL,
                source_group TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Monitored chats table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS monitored_chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                chat_id INTEGER,
                chat_title TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        
        await db.commit()
        # Spam settings table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS spam_settings (
                chat_id INTEGER PRIMARY KEY,
                block_links BOOLEAN DEFAULT 0,
                block_keywords TEXT DEFAULT '', -- comma separated
                flood_max_msgs INTEGER DEFAULT 0, -- 0 = disabled
                flood_window INTEGER DEFAULT 60, -- seconds
                flood_mute_time INTEGER DEFAULT 300, -- seconds
                action TEXT DEFAULT 'ban'
            )
        """)

        # Banned users challenge table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS banned_users (
                user_id INTEGER,
                chat_id INTEGER,
                attempts_left INTEGER DEFAULT 2,
                correct_answer INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, chat_id)
            )
        """)
        
        await db.commit()
        await db.commit()
        
        # Migrations for spam_settings
        await _ensure_column(db, "spam_settings", "flood_max_msgs", "INTEGER DEFAULT 0")
        await _ensure_column(db, "spam_settings", "flood_window", "INTEGER DEFAULT 60")
        await _ensure_column(db, "spam_settings", "flood_mute_time", "INTEGER DEFAULT 300")

        # P2P Exchange Tables
        await _ensure_column(db, "users", "role", "TEXT DEFAULT 'client'")
        await _ensure_column(db, "users", "rating", "REAL DEFAULT 5.0")
        await _ensure_column(db, "users", "deals_count", "INTEGER DEFAULT 0")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                amount REAL,
                currency TEXT,
                location TEXT,
                delivery_type TEXT, -- 'delivery' or 'pickup'
                status TEXT DEFAULT 'active', -- 'active', 'closed'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(telegram_id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS bids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                exchanger_id INTEGER,
                rate REAL,
                time_estimate TEXT,
                comment TEXT,
                status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(order_id) REFERENCES orders(id),
                FOREIGN KEY(exchanger_id) REFERENCES users(telegram_id)
            )
        """)
        await _ensure_column(db, "bids", "status", "TEXT DEFAULT 'pending'")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS market_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                type TEXT, -- 'buy' or 'sell'
                amount REAL,
                currency TEXT,
                rate REAL,
                location TEXT,
                description TEXT,
                image_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(telegram_id)
        )
        """)
        await _ensure_column(db, "market_posts", "image_data", "TEXT")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Add category to market_posts
        await _ensure_column(db, "market_posts", "category", "TEXT")

        # Web accounts for login/password auth
        await db.execute("""
            CREATE TABLE IF NOT EXISTS web_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT UNIQUE NOT NULL,
                name TEXT,
                password_hash TEXT NOT NULL,
                telegram_id INTEGER,
                phone TEXT,
                role TEXT DEFAULT 'client',
                is_seller_verified INTEGER DEFAULT 0,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Verification codes for web-to-bot linking
        await db.execute("""
            CREATE TABLE IF NOT EXISTS web_verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                code TEXT NOT NULL,
                verified INTEGER DEFAULT 0,
                telegram_id INTEGER,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(account_id) REFERENCES web_accounts(id)
            )
        """)

        # Seller verification codes (alphabetic)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS seller_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER,
                code TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Bot verification codes (bot sends to user, user enters on site)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS bot_verification_codes (
                telegram_id INTEGER PRIMARY KEY,
                phone TEXT NOT NULL,
                code TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.commit()
        logging.info("Tables created successfully")

async def add_user(telegram_id: int, language: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT OR IGNORE INTO users (telegram_id, language)
            VALUES (?, ?)
        """, (telegram_id, language))
        await db.execute("""
            UPDATE users SET language = ? WHERE telegram_id = ?
        """, (language, telegram_id))
        await db.commit()

async def update_user_session(telegram_id: int, session_string: str, phone: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            UPDATE users 
            SET session_string = ?, phone = ?, status = 'active'
            WHERE telegram_id = ?
        """, (session_string, phone, telegram_id))
        await db.commit()

async def get_user(telegram_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)) as cursor:
            return await cursor.fetchone()

async def add_monitored_chat(user_id: int, chat_id: int, chat_title: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT OR IGNORE INTO monitored_chats (user_id, chat_id, chat_title)
            VALUES (?, ?, ?)
        """, (user_id, chat_id, chat_title))
        await db.commit()

async def get_monitored_chats(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT chat_id FROM monitored_chats WHERE user_id = ?", (user_id,)) as cursor:
            rows = await cursor.fetchall()
            return [row[0] for row in rows]

async def get_monitored_chats_full(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT chat_id, chat_title FROM monitored_chats WHERE user_id = ?", (user_id,)) as cursor:
            rows = await cursor.fetchall()
            return [{"chat_id": row["chat_id"], "chat_title": row["chat_title"]} for row in rows]

async def clear_monitored_chats(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM monitored_chats WHERE user_id = ?", (user_id,))
        await db.commit()

async def remove_monitored_chat(user_id: int, chat_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM monitored_chats WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
        await db.commit()
async def add_market_rate(currency_pair: str, rate: float, source_group: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT INTO market_rates (currency_pair, rate_buy, source_group)
            VALUES (?, ?, ?)
        """, (currency_pair, rate, source_group))
        await db.commit()

async def get_average_rates():
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем средний курс за последние 24 часа
        async with db.execute("""
            SELECT currency_pair, AVG(rate_buy) 
            FROM market_rates 
            WHERE timestamp >= datetime('now', '-1 day')
            GROUP BY currency_pair
        """) as cursor:
            return await cursor.fetchall()

async def add_template(user_id: int, content: str, media_type: str, caption: str = None, entities: str = None, name: str = None):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("""
            INSERT INTO templates (user_id, content, media_type, caption, entities, name)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, content, media_type, caption, entities, name))
        await db.commit()
        return cursor.lastrowid

async def get_user_templates(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT id, content, media_type, caption, entities, name FROM templates WHERE user_id = ?", (user_id,)) as cursor:
            return await cursor.fetchall()




async def get_template(template_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM templates WHERE id = ?", (template_id,)) as cursor:
            return await cursor.fetchone()

async def deactivate_task(task_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE scheduled_tasks SET is_active = 0 WHERE id = ?", (task_id,))
        await db.commit()

async def delete_template(user_id: int, template_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM templates WHERE id = ? AND user_id = ?", (template_id, user_id))
        await db.execute("DELETE FROM scheduled_tasks WHERE template_id = ? AND user_id = ?", (template_id, user_id))
        await db.commit()

async def add_scheduled_task(user_id: int, template_id: int, target_groups: str, start_time: str, end_time: str, interval_minutes: int):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute(
            """
            INSERT INTO scheduled_tasks (user_id, template_id, target_groups, start_time, end_time, interval_minutes, run_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, template_id, target_groups, start_time, end_time, interval_minutes, f"{start_time}-{end_time}"),
        )
        await db.commit()
        return cursor.lastrowid


async def get_scheduled_tasks():
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, user_id, template_id, target_groups, start_time, end_time, interval_minutes
            FROM scheduled_tasks
            WHERE is_active = 1
            """
        ) as cursor:
            return await cursor.fetchall()


async def get_user_active_tasks(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, user_id, template_id, target_groups, start_time, end_time, interval_minutes
            FROM scheduled_tasks
            WHERE is_active = 1 AND user_id = ?
            """,
            (user_id,)
        ) as cursor:
            return await cursor.fetchall()


async def update_last_run(task_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE scheduled_tasks SET last_run = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
        await db.commit()


async def _ensure_column(db, table: str, column: str, definition: str):
    """Добавить колонку, если её ещё нет (простой миграционный хелпер)."""
    async with db.execute(f"PRAGMA table_info({table})") as cursor:
        cols = [row[1] for row in await cursor.fetchall()]
    if column not in cols:
        await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        await db.commit()

async def get_spam_settings(chat_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM spam_settings WHERE chat_id = ?", (chat_id,)) as cursor:
            return await cursor.fetchone()

async def update_spam_settings(chat_id: int, block_links: bool, block_keywords: str, flood_max_msgs: int = 0, flood_window: int = 60, flood_mute_time: int = 300):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT INTO spam_settings (chat_id, block_links, block_keywords, flood_max_msgs, flood_window, flood_mute_time)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
                block_links = excluded.block_links,
                block_keywords = excluded.block_keywords,
                flood_max_msgs = excluded.flood_max_msgs,
                flood_window = excluded.flood_window,
                flood_mute_time = excluded.flood_mute_time
        """, (chat_id, block_links, block_keywords, flood_max_msgs, flood_window, flood_mute_time))
        await db.commit()

async def add_banned_user_challenge(user_id: int, chat_id: int, correct_answer: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT OR REPLACE INTO banned_users (user_id, chat_id, attempts_left, correct_answer)
            VALUES (?, ?, 2, ?)
        """, (user_id, chat_id, correct_answer))
        await db.commit()

async def get_banned_user_challenge(user_id: int, chat_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM banned_users WHERE user_id = ? AND chat_id = ?", (user_id, chat_id)) as cursor:
            return await cursor.fetchone()

async def update_banned_attempts(user_id: int, chat_id: int, attempts: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE banned_users SET attempts_left = ? WHERE user_id = ? AND chat_id = ?", (attempts, user_id, chat_id))
        await db.commit()

async def remove_banned_user_challenge(user_id: int, chat_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM banned_users WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
        await db.commit()

# --- P2P Exchange Functions ---

async def update_user_role(telegram_id: int, role: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE users SET role = ? WHERE telegram_id = ?", (role, telegram_id))
        await db.commit()

async def create_order(user_id: int, amount: float, currency: str, location: str, delivery_type: str):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("""
            INSERT INTO orders (user_id, amount, currency, location, delivery_type)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, amount, currency, location, delivery_type))
        await db.commit()
        return cursor.lastrowid

async def get_active_orders():
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at DESC") as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def get_user_orders(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user_id,)) as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def get_order(order_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT o.*, u.phone, u.username 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.telegram_id
            WHERE o.id = ?
        """, (order_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def place_bid(order_id: int, exchanger_id: int, rate: float, time_estimate: str, comment: str):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("""
            INSERT INTO bids (order_id, exchanger_id, rate, time_estimate, comment)
            VALUES (?, ?, ?, ?, ?)
        """, (order_id, exchanger_id, rate, time_estimate, comment))
        await db.commit()
        return cursor.lastrowid

async def accept_bid(bid_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        # Get bid details first
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)) as cursor:
            bid = await cursor.fetchone()
            if not bid:
                return None
            bid = dict(bid)

        # Update order status to closed
        await db.execute("UPDATE orders SET status = 'closed' WHERE id = ?", (bid['order_id'],))
        
        # Update bid status to accepted
        await db.execute("UPDATE bids SET status = 'accepted' WHERE id = ?", (bid_id,))
        
        # Reject other bids for this order (optional, but good for clarity)
        await db.execute("UPDATE bids SET status = 'rejected' WHERE order_id = ? AND id != ?", (bid['order_id'], bid_id))
        
        await db.commit()
        return bid

async def get_order_bids(order_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        # Join with users to get exchanger info (rating, name/id)
        # Note: users table doesn't have name, we rely on telegram_id or fetch from bot
        async with db.execute("""
            SELECT b.*, u.rating, u.deals_count 
            FROM bids b
            JOIN users u ON b.exchanger_id = u.telegram_id
            WHERE b.order_id = ?
            ORDER BY b.rate DESC
        """, (order_id,)) as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def get_user_bids(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        # Join with orders to get order details
        async with db.execute("""
            SELECT b.*, o.amount, o.currency, o.location, o.status as order_status
            FROM bids b
            JOIN orders o ON b.order_id = o.id
            WHERE b.exchanger_id = ?
            ORDER BY b.created_at DESC
        """, (user_id,)) as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def create_market_post(user_id: int, p_type: str, amount: float, currency: str, rate: float, location: str, description: str, category: str = None, image_data: str = None):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT INTO market_posts (user_id, type, amount, currency, rate, location, description, category, image_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, p_type, amount, currency, rate, location, description, category, image_data))
        await db.commit()

async def get_market_posts():
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM market_posts ORDER BY created_at DESC LIMIT 50") as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def get_exchangers_by_location(location: str = None):
    # Simple mock for now, returns all exchangers
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT telegram_id, language FROM users WHERE role = 'exchanger'") as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def save_verification_code(phone: str, code: str):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            INSERT OR REPLACE INTO verification_codes (phone, code, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (phone, code))
        await db.commit()

async def verify_code(phone: str, code: str):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT code FROM verification_codes WHERE phone = ?", (phone,)) as cursor:
            row = await cursor.fetchone()
            if row and row[0] == code:
                await db.execute("DELETE FROM verification_codes WHERE phone = ?", (phone,))
                await db.commit()
                return True
            return False

async def save_verification_code_by_user(user_id: int, code: str, phone: str):
    """Save verification code linked to user_id"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Use code itself as the key for easy lookup
        await db.execute("""
            INSERT OR REPLACE INTO verification_codes (phone, code, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (f"code_{code}", str(user_id)))  # Store user_id in code column for retrieval
        # Also save the phone for later
        await db.execute("UPDATE users SET phone = ? WHERE telegram_id = ?", (phone, user_id))
        await db.commit()

async def verify_code_by_user(user_id: int, code: str) -> bool:
    """Verify code submitted by user through bot - code is the key"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Look up by code itself
        async with db.execute("SELECT code FROM verification_codes WHERE phone = ?", (f"code_{code}",)) as cursor:
            row = await cursor.fetchone()
            if row:
                # Mark code as verified (change phone prefix from code_ to verified_)
                await db.execute("UPDATE verification_codes SET phone = ? WHERE phone = ?", 
                               (f"verified_{code}", f"code_{code}"))
                # Also mark THIS user as verified
                await db.execute("UPDATE users SET status = 'verified' WHERE telegram_id = ?", (user_id,))
                await db.commit()
                return True
            return False

async def is_code_verified(code: str) -> bool:
    """Check if code has been verified via bot"""
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT 1 FROM verification_codes WHERE phone = ?", (f"verified_{code}",)) as cursor:
            row = await cursor.fetchone()
            return row is not None

async def is_user_verified(user_id: int) -> bool:
    """Check if user completed verification"""
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT status FROM users WHERE telegram_id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            return row and row[0] == 'verified'

async def update_user_profile(telegram_id: int, phone: str, username: str, name: str = None):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
            UPDATE users 
            SET phone = ?, username = ?, display_name = COALESCE(?, display_name) 
            WHERE telegram_id = ?
        """, (phone, username, name, telegram_id))
        await db.commit()

async def create_category(name: str, created_by: int):
    async with aiosqlite.connect(DB_NAME) as db:
        try:
            await db.execute("INSERT INTO categories (name, created_by) VALUES (?, ?)", (name, created_by))
            await db.commit()
            return True
        except aiosqlite.IntegrityError:
            return False

async def get_categories():
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT name FROM categories ORDER BY created_at DESC") as cursor:
            return [row['name'] for row in await cursor.fetchall()]

async def get_user_stats(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'active'", (user_id,)) as cursor:
            active = (await cursor.fetchone())[0]
        
        async with db.execute("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'closed'", (user_id,)) as cursor:
            completed = (await cursor.fetchone())[0]
            
        return {'active': active, 'completed': completed}

async def get_user_market_posts(user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM market_posts WHERE user_id = ? ORDER BY created_at DESC", (user_id,)) as cursor:
            return [dict(row) for row in await cursor.fetchall()]

async def update_market_post(post_id: int, user_id: int, amount: float, rate: float, description: str, p_type: str = None, currency: str = None, location: str = None, category: str = None, image_data: str = None):
    async with aiosqlite.connect(DB_NAME) as db:
        # Construct query dynamically based on provided fields
        fields = []
        values = []
        if amount is not None:
            fields.append("amount = ?")
            values.append(amount)
        if rate is not None:
            fields.append("rate = ?")
            values.append(rate)
        if description is not None:
            fields.append("description = ?")
            values.append(description)
        if p_type is not None:
            fields.append("type = ?")
            values.append(p_type)
        if currency is not None:
            fields.append("currency = ?")
            values.append(currency)
        if location is not None:
            fields.append("location = ?")
            values.append(location)
        if category is not None:
            fields.append("category = ?")
            values.append(category)
        if image_data is not None:
            fields.append("image_data = ?")
            values.append(image_data)
        
        if not fields:
            return

        values.append(post_id)
        values.append(user_id)
        
        query = f"UPDATE market_posts SET {', '.join(fields)} WHERE id = ? AND user_id = ?"
        await db.execute(query, tuple(values))
        await db.commit()

async def delete_market_post(post_id: int, user_id: int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM market_posts WHERE id = ? AND user_id = ?", (post_id, user_id))
        await db.commit()

# ============= WEB ACCOUNT AUTH FUNCTIONS =============

import hashlib
import secrets
import string

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_numeric_code(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def generate_alpha_code(length: int = 7) -> str:
    return ''.join(secrets.choice(string.ascii_lowercase) for _ in range(length))

async def check_nickname_exists(nickname: str) -> bool:
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT id FROM web_accounts WHERE LOWER(nickname) = LOWER(?)", (nickname,))
        row = await cursor.fetchone()
        return row is not None

async def register_web_account(nickname: str, name: str, password: str) -> dict:
    """Register new web account, returns account info with verification code"""
    if await check_nickname_exists(nickname):
        return {"error": "nickname_exists"}
    
    password_hash = hash_password(password)
    
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute(
            "INSERT INTO web_accounts (nickname, name, password_hash) VALUES (?, ?, ?)",
            (nickname, name, password_hash)
        )
        account_id = cursor.lastrowid
        
        # Generate verification code
        code = generate_numeric_code(6)
        await db.execute(
            "INSERT INTO web_verification_codes (account_id, code) VALUES (?, ?)",
            (account_id, code)
        )
        await db.commit()
        
        return {
            "success": True,
            "account_id": account_id,
            "nickname": nickname,
            "name": name,
            "code": code
        }

async def login_web_account(nickname: str, password: str) -> dict:
    """Login with nickname and password"""
    password_hash = hash_password(password)
    
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM web_accounts WHERE LOWER(nickname) = LOWER(?) AND password_hash = ?",
            (nickname, password_hash)
        )
        row = await cursor.fetchone()
        
        if not row:
            return {"error": "invalid_credentials"}
        
        return {
            "success": True,
            "account_id": row["id"],
            "nickname": row["nickname"],
            "name": row["name"],
            "role": row["role"],
            "telegram_linked": row["telegram_id"] is not None,
            "is_seller": row["is_seller_verified"] == 1
        }

async def verify_code_from_bot(code: str, telegram_id: int, phone: str) -> dict:
    """Bot verifies the code and links Telegram account"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Find the code
        cursor = await db.execute(
            "SELECT id, account_id FROM web_verification_codes WHERE code = ? AND verified = 0",
            (code,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return {"error": "invalid_code"}
        
        code_id, account_id = row
        
        # Update verification
        await db.execute(
            "UPDATE web_verification_codes SET verified = 1, telegram_id = ?, phone = ? WHERE id = ?",
            (telegram_id, phone, code_id)
        )
        
        # Link telegram to account
        await db.execute(
            "UPDATE web_accounts SET telegram_id = ?, phone = ? WHERE id = ?",
            (telegram_id, phone, account_id)
        )
        await db.commit()
        
        return {"success": True, "account_id": account_id}

async def check_code_verified(code: str) -> dict:
    """Check if verification code was verified by bot"""
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """SELECT wv.verified, wv.telegram_id, wv.phone, wa.nickname, wa.name, wa.role 
               FROM web_verification_codes wv 
               JOIN web_accounts wa ON wv.account_id = wa.id 
               WHERE wv.code = ?""",
            (code,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return {"verified": False}
        
        if row["verified"]:
            return {
                "verified": True,
                "nickname": row["nickname"],
                "name": row["name"],
                "role": row["role"],
                "telegram_id": row["telegram_id"]
            }
        return {"verified": False}

async def get_account_by_id(account_id: int) -> dict:
    async with aiosqlite.connect(DB_NAME) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM web_accounts WHERE id = ?", (account_id,))
        row = await cursor.fetchone()
        if row:
            return dict(row)
        return None

# ============= SELLER VERIFICATION =============

async def generate_seller_code(telegram_id: int) -> str:
    """Generate alphabetic code for seller verification"""
    code = generate_alpha_code(7)
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            "INSERT INTO seller_codes (telegram_id, code) VALUES (?, ?)",
            (telegram_id, code)
        )
        await db.commit()
    return code

async def verify_seller_code(code: str, account_id: int) -> bool:
    """Verify seller code and upgrade account"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Find unused code
        cursor = await db.execute(
            "SELECT id, telegram_id FROM seller_codes WHERE LOWER(code) = LOWER(?) AND used = 0",
            (code,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return False
        
        code_id, telegram_id = row
        
        # Mark code as used
        await db.execute("UPDATE seller_codes SET used = 1 WHERE id = ?", (code_id,))
        
        # Upgrade account to seller
        await db.execute(
            "UPDATE web_accounts SET role = 'exchanger', is_seller_verified = 1 WHERE id = ?",
            (account_id,)
        )
        await db.commit()
        return True

# ============= BOT VERIFICATION (Bot sends code, user enters on site) =============

async def generate_bot_verification_code(telegram_id: int, phone: str) -> str:
    """Bot generates code and sends to user. User will enter this on website."""
    code = generate_numeric_code(6)
    async with aiosqlite.connect(DB_NAME) as db:
        # Store the code
        await db.execute(
            "INSERT OR REPLACE INTO bot_verification_codes (telegram_id, phone, code, created_at) VALUES (?, ?, ?, datetime('now'))",
            (telegram_id, phone, code)
        )
        await db.commit()
    return code

async def verify_bot_code(code: str, account_id: int = None) -> dict:
    """User enters code on website. Link phone to account."""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute(
            "SELECT telegram_id, phone FROM bot_verification_codes WHERE code = ? AND used = 0",
            (code,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return {"error": "invalid_code"}
        
        telegram_id, phone = row
        
        # Mark as used
        await db.execute("UPDATE bot_verification_codes SET used = 1 WHERE code = ?", (code,))
        
        # Link to account if provided
        if account_id:
            await db.execute(
                "UPDATE web_accounts SET telegram_id = ?, phone = ? WHERE id = ?",
                (telegram_id, phone, account_id)
            )
        
        await db.commit()
        return {"success": True, "telegram_id": telegram_id, "phone": phone}

async def is_phone_registered(phone: str) -> bool:
    """Check if phone number is already registered"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Clean phone number
        clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '')
        cursor = await db.execute(
            "SELECT id FROM web_accounts WHERE REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') = ?",
            (clean_phone,)
        )
        row = await cursor.fetchone()
        return row is not None

# ============= ADMIN FUNCTIONS =============

async def delete_all_posts():
    """Admin function to clear all market posts"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM market_posts")
        await db.commit()
        cursor = await db.execute("SELECT changes()")
        row = await cursor.fetchone()
        return row[0] if row else 0

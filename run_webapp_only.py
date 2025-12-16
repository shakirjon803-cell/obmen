"""
Run only the Web App server (without bot polling)
For testing Mini App through cloudflared tunnel
"""
import asyncio
import logging
from aiogram import Bot
from aiohttp import web
from bot.database.database import create_tables
from bot.web_app import init_web_app
from config import BOT_TOKEN

logging.basicConfig(level=logging.INFO)


async def main():
    await create_tables()

    bot = Bot(token=BOT_TOKEN)

    # Start Web App Server
    try:
        import os
        port = int(os.getenv('PORT', 8080))
        app = await init_web_app(bot)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logging.info(f"🚀 Web App started on http://localhost:{port}")
        logging.info("Bot polling is DISABLED - only web server is running")
        logging.info("Use cloudflared tunnel for Mini App testing")
        
        # Keep running forever
        while True:
            await asyncio.sleep(3600)
            
    except Exception as e:
        logging.error(f"Failed to start Web App: {e}")
    finally:
        await bot.session.close()
        await runner.cleanup()


if __name__ == "__main__":
    if not BOT_TOKEN:
        logging.error("BOT_TOKEN не найден в config.py / .env")
    else:
        try:
            asyncio.run(main())
        except (KeyboardInterrupt, SystemExit):
            logging.info("Web App stopped!")

import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiohttp import web
from bot.database.database import create_tables
from bot.services.scheduler import scheduler, start_scheduler, load_scheduled_mailings
from bot.web_app import init_web_app
from config import BOT_TOKEN

logging.basicConfig(level=logging.INFO)


async def main():
    await create_tables()

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    # Routers
    from bot.handlers.antispam_menu import router as antispam_menu_router
    from bot.handlers.spam import router as spam_router
    from bot.handlers.onboarding import router as onboarding_router
    from bot.handlers.main_menu import router as main_menu_router
    from bot.handlers.mailing import router as mailing_router
    from bot.handlers.admin import router as admin_router
    from bot.handlers.calculator import router as calculator_router
    from bot.handlers.dashboard import router as dashboard_router
    from bot.handlers.admin_commands import router as admin_commands_router
    from bot.handlers.order_flow import router as order_flow_router

    dp.include_router(antispam_menu_router)
    dp.include_router(spam_router)
    dp.include_router(onboarding_router)
    dp.include_router(main_menu_router)
    dp.include_router(mailing_router)
    dp.include_router(admin_router)
    dp.include_router(calculator_router)
    dp.include_router(dashboard_router)
    dp.include_router(admin_commands_router)
    dp.include_router(order_flow_router)

    # Background jobs
    start_scheduler()
    await load_scheduled_mailings()

    # Start Web App Server
    try:
        import os
        port = int(os.getenv('PORT', 8080))
        app = await init_web_app(bot)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logging.info(f"🚀 Web App started on http://0.0.0.0:{port}")
    except Exception as e:
        logging.error(f"Failed to start Web App: {e}")

    # Keep the app running even if polling fails
    while True:
        try:
            await dp.start_polling(bot)
        except Exception as e:
            logging.error(f"Polling error: {e}")
            logging.info("Restarting polling in 5 seconds...")
            await asyncio.sleep(5)
        else:
            # If polling stops gracefully (e.g. via signal), break the loop
            break
            
    await bot.session.close()
    if scheduler.running:
        scheduler.shutdown(wait=False)
    # Cleanup web app
    await runner.cleanup()


if __name__ == "__main__":
    if not BOT_TOKEN:
        logging.error("BOT_TOKEN не найден в config.py / .env")
    else:
        try:
            asyncio.run(main())
        except (KeyboardInterrupt, SystemExit):
            logging.info("Bot stopped!")

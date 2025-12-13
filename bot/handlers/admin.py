import aiosqlite
from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.context import FSMContext
from config import ADMIN_IDS
from bot.database.database import DB_NAME
from bot.keyboards.main_menu import get_main_menu_keyboard

router = Router()

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ==================== ADMIN PANEL KEYBOARDS ====================

def get_admin_panel_keyboard():
    """Main admin panel keyboard"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 Статистика", callback_data="adm:stats")],
        [InlineKeyboardButton(text="📋 Посты", callback_data="adm:posts")],
        [InlineKeyboardButton(text="📝 Заявки", callback_data="adm:orders")],
        [InlineKeyboardButton(text="👥 Обменники", callback_data="adm:exchangers")],
        [InlineKeyboardButton(text="📢 Рассылка", callback_data="adm:broadcast")],
        [InlineKeyboardButton(text="📦 Экспорт БД", callback_data="adm:export")],
        [InlineKeyboardButton(text="🗑 Полная очистка", callback_data="adm:clearall")],
        [InlineKeyboardButton(text="❌ Закрыть", callback_data="adm:close")],
    ])


# ==================== OPEN ADMIN PANEL ====================

@router.callback_query(F.data == "menu_admin")
async def menu_admin(callback: types.CallbackQuery):
    """Open admin panel from main menu button"""
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Нет прав", show_alert=True)
        return

    await callback.message.edit_text(
        "🛠 <b>Админ-панель NellX</b>\n\n"
        "Выберите действие:",
        parse_mode="HTML",
        reply_markup=get_admin_panel_keyboard()
    )
    await callback.answer()


@router.message(Command("admin"))
async def cmd_admin(message: types.Message):
    """Open admin panel via /admin command"""
    if not is_admin(message.from_user.id):
        return

    await message.answer(
        "🛠 <b>Админ-панель NellX</b>\n\n"
        "Выберите действие:",
        parse_mode="HTML",
        reply_markup=get_admin_panel_keyboard()
    )


@router.callback_query(F.data == "adm:back")
async def admin_back(callback: types.CallbackQuery):
    """Back to admin panel"""
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "🛠 <b>Админ-панель NellX</b>\n\n"
        "Выберите действие:",
        parse_mode="HTML",
        reply_markup=get_admin_panel_keyboard()
    )
    await callback.answer()


@router.callback_query(F.data == "adm:close")
async def admin_close(callback: types.CallbackQuery):
    """Close admin panel"""
    await callback.message.delete()
    await callback.answer("Админ-панель закрыта")


# ==================== STATISTICS ====================

@router.callback_query(F.data == "adm:stats")
async def admin_stats(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)

    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT COUNT(*) FROM users") as cursor:
            total_users = (await cursor.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM users WHERE session_string IS NOT NULL") as cursor:
            active_users = (await cursor.fetchone())[0]
        try:
            async with db.execute("SELECT COUNT(*) FROM web_accounts") as cursor:
                web_accounts = (await cursor.fetchone())[0]
        except:
            web_accounts = 0
        try:
            async with db.execute("SELECT COUNT(*) FROM market_posts") as cursor:
                posts = (await cursor.fetchone())[0]
        except:
            posts = 0
        try:
            async with db.execute("SELECT COUNT(*) FROM orders") as cursor:
                orders = (await cursor.fetchone())[0]
        except:
            orders = 0
        try:
            async with db.execute("SELECT COUNT(*) FROM web_accounts WHERE role = 'exchanger' OR is_seller_verified = 1") as cursor:
                exchangers = (await cursor.fetchone())[0]
        except:
            exchangers = 0

    await callback.message.edit_text(
        "📊 <b>Статистика</b>\n\n"
        f"👥 Пользователей бота: <b>{total_users}</b>\n"
        f"✅ Авторизовано: <b>{active_users}</b>\n"
        f"📱 Аккаунтов на сайте: <b>{web_accounts}</b>\n"
        f"💼 Обменников: <b>{exchangers}</b>\n"
        f"📋 Постов: <b>{posts}</b>\n"
        f"📝 Заявок: <b>{orders}</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔄 Обновить", callback_data="adm:stats")],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:back")],
        ])
    )
    await callback.answer()


# ==================== POSTS MANAGEMENT ====================

@router.callback_query(F.data == "adm:posts")
async def admin_posts(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "📋 <b>Управление постами</b>\n\n"
        "Посты - объявления обменников на сайте.",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🗑 Удалить все посты", callback_data="adm:clear_posts")],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:back")],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:clear_posts")
async def admin_clear_posts_confirm(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "⚠️ <b>Удалить ВСЕ посты?</b>\n\n"
        "Это действие необратимо!",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Да", callback_data="adm:do_clear_posts"),
                InlineKeyboardButton(text="❌ Нет", callback_data="adm:posts")
            ],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:do_clear_posts")
async def admin_do_clear_posts(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM market_posts")
        await db.commit()
    
    await callback.message.edit_text(
        "✅ <b>Все посты удалены!</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:posts")],
        ])
    )
    await callback.answer("Посты удалены!")


# ==================== ORDERS MANAGEMENT ====================

@router.callback_query(F.data == "adm:orders")
async def admin_orders(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "📝 <b>Управление заявками</b>\n\n"
        "Заявки - запросы клиентов на обмен.",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🗑 Удалить все заявки", callback_data="adm:clear_orders")],
            [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:back")],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:clear_orders")
async def admin_clear_orders_confirm(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "⚠️ <b>Удалить ВСЕ заявки и ставки?</b>\n\n"
        "Это действие необратимо!",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Да", callback_data="adm:do_clear_orders"),
                InlineKeyboardButton(text="❌ Нет", callback_data="adm:orders")
            ],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:do_clear_orders")
async def admin_do_clear_orders(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    from bot.database.database import clear_all_orders
    await clear_all_orders()
    
    await callback.message.edit_text(
        "✅ <b>Все заявки и ставки удалены!</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:orders")],
        ])
    )
    await callback.answer("Заявки удалены!")


# ==================== EXCHANGERS MANAGEMENT ====================

@router.callback_query(F.data == "adm:exchangers")
async def admin_exchangers(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    from bot.database.database import get_all_exchangers
    exchangers = await get_all_exchangers()
    
    if not exchangers:
        await callback.message.edit_text(
            "👥 <b>Обменники</b>\n\n"
            "Нет зарегистрированных обменников.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🔙 Назад", callback_data="adm:back")],
            ])
        )
        return await callback.answer()
    
    # Create buttons for each exchanger
    buttons = []
    for ex in exchangers:
        name = (ex.get('name') or ex.get('nickname') or 'N/A')[:20]
        verified = "✅" if ex.get('is_seller_verified') else "❌"
        buttons.append([
            InlineKeyboardButton(
                text=f"{verified} {name}",
                callback_data=f"adm:ex:{ex.get('telegram_id')}"
            )
        ])
    
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data="adm:back")])
    
    await callback.message.edit_text(
        f"👥 <b>Обменники ({len(exchangers)})</b>\n\n"
        "Выберите для управления:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:ex:"))
async def admin_exchanger_detail(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    telegram_id = int(callback.data.split(":")[2])
    
    from bot.database.database import get_all_exchangers
    exchangers = await get_all_exchangers()
    ex = next((e for e in exchangers if e.get('telegram_id') == telegram_id), None)
    
    if not ex:
        return await callback.answer("❌ Не найден", show_alert=True)
    
    name = ex.get('name') or ex.get('nickname') or 'N/A'
    verified = "✅ Верифицирован" if ex.get('is_seller_verified') else "❌ Не верифицирован"
    
    await callback.message.edit_text(
        f"👤 <b>{name}</b>\n\n"
        f"📱 ID: <code>{telegram_id}</code>\n"
        f"🏷 Ник: {ex.get('nickname', 'N/A')}\n"
        f"📊 {verified}\n\n"
        "Снять статус обменника:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔄 Без бана (может вернуться)", callback_data=f"adm:rev:{telegram_id}:none")],
            [InlineKeyboardButton(text="⏰ Бан на 24 часа", callback_data=f"adm:rev:{telegram_id}:24")],
            [InlineKeyboardButton(text="⏰ Бан на 7 дней", callback_data=f"adm:rev:{telegram_id}:168")],
            [InlineKeyboardButton(text="🚫 Бан навсегда", callback_data=f"adm:rev:{telegram_id}:perm")],
            [InlineKeyboardButton(text="🔙 К списку", callback_data="adm:exchangers")],
        ])
    )
    await callback.answer()


@router.callback_query(F.data.startswith("adm:rev:"))
async def admin_revoke_exchanger(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    parts = callback.data.split(":")
    telegram_id = int(parts[2])
    action = parts[3]
    
    ban_type = None
    ban_hours = None
    
    if action == "perm":
        ban_type = "permanent"
        status = "🚫 Забанен навсегда"
    elif action == "none":
        status = "✅ Может снова стать обменником"
    else:
        ban_type = "temporary"
        ban_hours = int(action)
        status = f"⏰ Бан на {ban_hours} часов"
    
    from bot.database.database import revoke_exchanger_status
    await revoke_exchanger_status(telegram_id, ban_type, ban_hours)
    
    await callback.message.edit_text(
        f"✅ <b>Статус снят!</b>\n\n"
        f"ID: <code>{telegram_id}</code>\n"
        f"Результат: {status}",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 К списку", callback_data="adm:exchangers")],
        ])
    )
    await callback.answer("Готово!")


# ==================== BROADCAST ====================

class AdminState(StatesGroup):
    waiting_for_broadcast = State()


@router.callback_query(F.data == "adm:broadcast")
async def admin_broadcast_start(callback: types.CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await state.set_state(AdminState.waiting_for_broadcast)
    await callback.message.edit_text(
        "📢 <b>Рассылка</b>\n\n"
        "Отправьте сообщение для рассылки всем пользователям.\n\n"
        "Или нажмите Отмена:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Отмена", callback_data="adm:cancel_broadcast")],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:cancel_broadcast")
async def admin_cancel_broadcast(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🛠 <b>Админ-панель NellX</b>\n\n"
        "Выберите действие:",
        parse_mode="HTML",
        reply_markup=get_admin_panel_keyboard()
    )
    await callback.answer("Отменено")


@router.message(AdminState.waiting_for_broadcast)
async def process_broadcast(message: types.Message, state: FSMContext, bot):
    text = message.text or message.caption
    if not text:
        await message.answer("❌ Нужно отправить текст.")
        return

    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute("SELECT telegram_id FROM users") as cursor:
            users = await cursor.fetchall()

    count = 0
    for user in users:
        try:
            await bot.send_message(user[0], text)
            count += 1
        except Exception:
            pass

    await message.answer(
        f"✅ <b>Рассылка завершена!</b>\n\n"
        f"Отправлено: {count} из {len(users)}",
        parse_mode="HTML",
        reply_markup=get_admin_panel_keyboard()
    )
    await state.clear()


# ==================== EXPORT DB ====================

@router.callback_query(F.data == "adm:export")
async def admin_export(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    file = types.FSInputFile(DB_NAME)
    await callback.message.answer_document(file, caption="📦 Backup базы данных")
    await callback.answer("Файл отправлен!")


# ==================== FULL CLEAR ====================

@router.callback_query(F.data == "adm:clearall")
async def admin_clearall_confirm(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    await callback.message.edit_text(
        "⚠️ <b>ПОЛНАЯ ОЧИСТКА</b>\n\n"
        "Будут удалены:\n"
        "• Все пользователи (кроме админов)\n"
        "• Все посты\n"
        "• Все аккаунты\n"
        "• Все коды верификации\n\n"
        "<b>Это необратимо!</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Да, очистить", callback_data="adm:do_clearall"),
                InlineKeyboardButton(text="❌ Отмена", callback_data="adm:back")
            ],
        ])
    )
    await callback.answer()


@router.callback_query(F.data == "adm:do_clearall")
async def admin_do_clearall(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.id):
        return await callback.answer("❌ Нет прав", show_alert=True)
    
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("DELETE FROM market_posts")
        await db.execute("DELETE FROM web_accounts")
        admin_ids_str = ",".join(str(id) for id in ADMIN_IDS)
        await db.execute(f"DELETE FROM users WHERE telegram_id NOT IN ({admin_ids_str})")
        await db.execute("DELETE FROM web_verification_codes")
        await db.execute("DELETE FROM seller_codes")
        await db.execute("DELETE FROM bot_verification_codes")
        try:
            await db.execute("DELETE FROM orders")
            await db.execute("DELETE FROM bids")
        except:
            pass
        await db.commit()
    
    await callback.message.edit_text(
        "🗑 <b>Очистка завершена!</b>\n\n"
        "✅ Все пользователи удалены\n"
        "✅ Все посты удалены\n"
        "✅ Все аккаунты удалены\n"
        "✅ Все коды удалены\n\n"
        "Можно тестировать с нуля.",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 В меню", callback_data="adm:back")],
        ])
    )
    await callback.answer("Очистка завершена!")

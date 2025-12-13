from aiogram import Router, F, types
from aiogram.filters import Command, CommandObject
from aiogram.types import ChatPermissions, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from bot.services.time_util import parse_time_string
import time

router = Router()

# Bot admin IDs
ADMIN_IDS = [5912983856]  # Add your admin Telegram IDs

def is_bot_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ==================== GROUP ADMIN COMMANDS ====================

def get_target_user(message: types.Message):
    if message.reply_to_message:
        return message.reply_to_message.from_user
    return None

async def is_admin(message: types.Message):
    member = await message.chat.get_member(message.from_user.id)
    return member.status in ["administrator", "creator"]

@router.message(Command("ban"))
async def cmd_ban(message: types.Message):
    if not await is_admin(message):
        return await message.reply("❌ Эта команда доступна только администраторам.")
    
    target = get_target_user(message)
    if not target:
        return await message.reply("⚠️ Ответьте на сообщение пользователя, которого нужно забанить.")
    
    try:
        await message.chat.ban(target.id)
        await message.reply(f"🚫 Пользователь {target.full_name} был забанен.")
    except Exception as e:
        await message.reply(f"❌ Не удалось забанить: {e}")

@router.message(Command("kick"))
async def cmd_kick(message: types.Message):
    if not await is_admin(message):
        return await message.reply("❌ Эта команда доступна только администраторам.")
    
    target = get_target_user(message)
    if not target:
        return await message.reply("⚠️ Ответьте на сообщение пользователя, которого нужно выгнать.")
    
    try:
        await message.chat.ban(target.id)
        await message.chat.unban(target.id)
        await message.reply(f"👢 Пользователь {target.full_name} был выгнан.")
    except Exception as e:
        await message.reply(f"❌ Не удалось выгнать: {e}")

@router.message(Command("mute"))
async def cmd_mute(message: types.Message, command: CommandObject):
    if not await is_admin(message):
        return await message.reply("❌ Эта команда доступна только администраторам.")
    
    target = get_target_user(message)
    if not target:
        return await message.reply("⚠️ Ответьте на сообщение пользователя.")
    
    duration = 0
    if command.args:
        duration = parse_time_string(command.args)
    
    permissions = ChatPermissions(can_send_messages=False)
    until_date = int(time.time()) + duration if duration > 0 else None
    
    try:
        await message.chat.restrict(target.id, permissions=permissions, until_date=until_date)
        time_str = f"на {command.args}" if duration > 0 else "навсегда"
        await message.reply(f"🔇 Пользователь {target.full_name} заглушен {time_str}.")
    except Exception as e:
        await message.reply(f"❌ Не удалось заглушить: {e}")

@router.message(Command("unmute"))
async def cmd_unmute(message: types.Message):
    if not await is_admin(message):
        return await message.reply("❌ Эта команда доступна только администраторам.")
    
    target = get_target_user(message)
    if not target:
        return await message.reply("⚠️ Ответьте на сообщение пользователя.")
    
    permissions = ChatPermissions(
        can_send_messages=True,
        can_send_media_messages=True,
        can_send_other_messages=True,
        can_send_polls=True
    )
    
    try:
        await message.chat.restrict(target.id, permissions=permissions)
        await message.reply(f"🔊 С пользователя {target.full_name} сняты ограничения.")
    except Exception as e:
        await message.reply(f"❌ Не удалось размутить: {e}")


# ==================== ADMIN PANEL (INLINE BUTTONS) ====================

def get_admin_panel_keyboard():
    """Main admin panel keyboard"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Посты", callback_data="admin:posts_menu")],
        [InlineKeyboardButton(text="📝 Заявки", callback_data="admin:orders_menu")],
        [InlineKeyboardButton(text="👥 Обменники", callback_data="admin:exchangers_menu")],
        [InlineKeyboardButton(text="❌ Закрыть", callback_data="admin:close")],
    ])

def get_posts_menu_keyboard():
    """Posts management menu"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🗑 Удалить все посты", callback_data="admin:clear_posts")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:back")],
    ])

def get_orders_menu_keyboard():
    """Orders management menu"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🗑 Удалить все заявки", callback_data="admin:clear_orders")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:back")],
    ])

def get_exchangers_menu_keyboard():
    """Exchangers management menu"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Список обменников", callback_data="admin:list_exchangers")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:back")],
    ])


@router.message(Command("admin"))
async def cmd_admin_panel(message: types.Message):
    """Open admin panel"""
    if not is_bot_admin(message.from_user.id):
        return await message.reply("❌ Только для администраторов бота.")
    
    await message.answer(
        "🔧 <b>Админ-панель NellX</b>\n\n"
        "Выберите раздел:",
        reply_markup=get_admin_panel_keyboard(),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "admin:back")
async def admin_back(callback: CallbackQuery):
    """Back to main admin menu"""
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    await callback.message.edit_text(
        "🔧 <b>Админ-панель NellX</b>\n\n"
        "Выберите раздел:",
        reply_markup=get_admin_panel_keyboard(),
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:close")
async def admin_close(callback: CallbackQuery):
    """Close admin panel"""
    await callback.message.delete()
    await callback.answer("Админ-панель закрыта")


# ==================== POSTS MENU ====================

@router.callback_query(F.data == "admin:posts_menu")
async def admin_posts_menu(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    await callback.message.edit_text(
        "📋 <b>Управление постами</b>\n\n"
        "Посты - это объявления от обменников на сайте.",
        reply_markup=get_posts_menu_keyboard(),
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:clear_posts")
async def admin_clear_posts(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    # Confirm button
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, удалить", callback_data="admin:confirm_clear_posts"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="admin:posts_menu")
        ],
    ])
    
    await callback.message.edit_text(
        "⚠️ <b>Вы уверены?</b>\n\n"
        "Это удалит ВСЕ посты с сайта.\n"
        "Действие необратимо!",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:confirm_clear_posts")
async def admin_confirm_clear_posts(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    from bot.database.database import delete_all_posts
    count = await delete_all_posts()
    
    await callback.message.edit_text(
        f"✅ <b>Готово!</b>\n\n"
        f"Удалено постов: {count}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:posts_menu")],
        ]),
        parse_mode="HTML"
    )
    await callback.answer("Посты удалены!")


# ==================== ORDERS MENU ====================

@router.callback_query(F.data == "admin:orders_menu")
async def admin_orders_menu(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    await callback.message.edit_text(
        "📝 <b>Управление заявками</b>\n\n"
        "Заявки - это запросы клиентов на обмен валюты.",
        reply_markup=get_orders_menu_keyboard(),
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:clear_orders")
async def admin_clear_orders(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, удалить", callback_data="admin:confirm_clear_orders"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="admin:orders_menu")
        ],
    ])
    
    await callback.message.edit_text(
        "⚠️ <b>Вы уверены?</b>\n\n"
        "Это удалит ВСЕ заявки и ставки.\n"
        "Действие необратимо!",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:confirm_clear_orders")
async def admin_confirm_clear_orders(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    from bot.database.database import clear_all_orders
    count = await clear_all_orders()
    
    await callback.message.edit_text(
        f"✅ <b>Готово!</b>\n\n"
        f"Удалено записей: {count}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:orders_menu")],
        ]),
        parse_mode="HTML"
    )
    await callback.answer("Заявки удалены!")


# ==================== EXCHANGERS MENU ====================

@router.callback_query(F.data == "admin:exchangers_menu")
async def admin_exchangers_menu(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    await callback.message.edit_text(
        "👥 <b>Управление обменниками</b>\n\n"
        "Здесь можно просмотреть список обменников и снять с них статус.",
        reply_markup=get_exchangers_menu_keyboard(),
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data == "admin:list_exchangers")
async def admin_list_exchangers(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    from bot.database.database import get_all_exchangers
    exchangers = await get_all_exchangers()
    
    if not exchangers:
        await callback.message.edit_text(
            "📋 <b>Обменники</b>\n\n"
            "Нет зарегистрированных обменников.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:exchangers_menu")],
            ]),
            parse_mode="HTML"
        )
        return await callback.answer()
    
    # Create buttons for each exchanger
    buttons = []
    for ex in exchangers:
        name = ex.get('name', ex.get('nickname', 'N/A'))[:20]
        verified = "✅" if ex.get('is_seller_verified') else "❌"
        buttons.append([
            InlineKeyboardButton(
                text=f"{verified} {name}",
                callback_data=f"admin:exchanger:{ex.get('telegram_id')}"
            )
        ])
    
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data="admin:exchangers_menu")])
    
    await callback.message.edit_text(
        f"📋 <b>Обменники ({len(exchangers)})</b>\n\n"
        "Выберите обменника для управления:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:exchanger:"))
async def admin_exchanger_detail(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    telegram_id = int(callback.data.split(":")[2])
    
    from bot.database.database import get_all_exchangers
    exchangers = await get_all_exchangers()
    exchanger = next((e for e in exchangers if e.get('telegram_id') == telegram_id), None)
    
    if not exchanger:
        return await callback.answer("❌ Обменник не найден", show_alert=True)
    
    name = exchanger.get('name', exchanger.get('nickname', 'N/A'))
    verified = "✅ Верифицирован" if exchanger.get('is_seller_verified') else "❌ Не верифицирован"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚫 Снять статус (без бана)", callback_data=f"admin:revoke:{telegram_id}:none")],
        [InlineKeyboardButton(text="⏰ Снять + бан 24ч", callback_data=f"admin:revoke:{telegram_id}:temp:24")],
        [InlineKeyboardButton(text="⏰ Снять + бан 7 дней", callback_data=f"admin:revoke:{telegram_id}:temp:168")],
        [InlineKeyboardButton(text="🔴 Снять + бан навсегда", callback_data=f"admin:revoke:{telegram_id}:perm")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin:list_exchangers")],
    ])
    
    await callback.message.edit_text(
        f"👤 <b>{name}</b>\n\n"
        f"📱 ID: <code>{telegram_id}</code>\n"
        f"🏷 Ник: {exchanger.get('nickname', 'N/A')}\n"
        f"📊 Статус: {verified}\n\n"
        "Выберите действие:",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:revoke:"))
async def admin_revoke_exchanger(callback: CallbackQuery):
    if not is_bot_admin(callback.from_user.id):
        return await callback.answer("❌ Нет доступа", show_alert=True)
    
    parts = callback.data.split(":")
    telegram_id = int(parts[2])
    action = parts[3]
    
    ban_type = None
    ban_hours = None
    
    if action == "perm":
        ban_type = "permanent"
        status_text = "🚫 Забанен навсегда"
    elif action == "temp":
        ban_type = "temporary"
        ban_hours = int(parts[4])
        status_text = f"⏰ Бан на {ban_hours} часов"
    else:
        status_text = "✅ Может снова стать обменником"
    
    from bot.database.database import revoke_exchanger_status
    await revoke_exchanger_status(telegram_id, ban_type, ban_hours)
    
    await callback.message.edit_text(
        f"✅ <b>Статус снят</b>\n\n"
        f"ID: <code>{telegram_id}</code>\n"
        f"Результат: {status_text}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 К списку", callback_data="admin:list_exchangers")],
        ]),
        parse_mode="HTML"
    )
    await callback.answer("Статус обменника снят!")


# ==================== SELLER CODE (keep as command) ====================

@router.message(Command("seller_code"))
async def cmd_seller_code(message: types.Message):
    """Generate seller verification code"""
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(message.from_user.id)
    await message.reply(
        f"Ваш код продавца: <b>{code}</b>\n\n"
        "Введите этот код на сайте чтобы стать продавцом.",
        parse_mode="HTML"
    )

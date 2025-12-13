from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.filters import Command
from bot.database.database import (
    create_order, get_order, place_bid, accept_bid, get_order_bids,
    get_exchangers_by_location, get_user, update_user_role,
    update_bid_message_id, get_rejected_bids_with_messages, get_order_client_id
)
from config import WEBAPP_URL
import logging

router = Router()

# States for order creation in bot
class BotOrderStates(StatesGroup):
    choosing_from_currency = State()
    choosing_to_currency = State()
    entering_amount = State()
    entering_location = State()
    confirming = State()

class BidStates(StatesGroup):
    waiting_for_rate = State()
    waiting_for_comment = State()

# Currencies for Egypt exchange (Egyptians exchanging with CIS countries)
CURRENCIES = {
    'EGP': '🇪🇬 EGP (Египетский фунт)',
    'USD': '💵 USD (Доллар)',
    'UZS': '🇺🇿 UZS (Узбекский сум)',
    'RUB': '🇷🇺 RUB (Российский рубль)',
    'KZT': '🇰🇿 KZT (Казахский тенге)',
    'KGS': '🇰🇬 KGS (Киргизский сом)',
    'TJS': '🇹🇯 TJS (Таджикский сомони)',
}

# Egyptian locations - Cairo districts
LOCATIONS = {
    'r4': '📍 4-й район',
    'r5': '📍 5-й район', 
    'r6': '📍 6-й район',
    'r7': '📍 7-й район',
    'r8': '📍 8-й район',
    'r9': '📍 9-й район',
    'r10': '📍 10-й район',
    'vaha': '📍 Ваха',
    'other': '✏️ Другое место',
}

# ==================== CHANGE ROLE ====================

@router.callback_query(F.data == "change_role")
async def change_role_menu(callback: CallbackQuery):
    """Show role selection menu"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👤 Клиент", callback_data="set_role:client")],
        [InlineKeyboardButton(text="💼 Обменник", callback_data="set_role:exchanger")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    
    await callback.message.edit_text(
        "🔄 <b>Выберите роль:</b>\n\n"
        "👤 <b>Клиент</b> - создаёте заявки на обмен\n"
        "💼 <b>Обменник</b> - принимаете заявки и предлагаете курсы",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("set_role:"))
async def set_role(callback: CallbackQuery):
    """Set user role and open mini app with that role"""
    role = callback.data.split(":")[1]
    user_id = callback.from_user.id
    
    # Save role to database
    await update_user_role(user_id, role)
    
    role_name = "Клиент" if role == "client" else "Обменник"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"📱 Открыть приложение как {role_name}",
            url=f"{WEBAPP_URL}?role={role}"
        )],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    
    await callback.message.edit_text(
        f"✅ Роль установлена: <b>{role_name}</b>\n\n"
        f"Нажмите кнопку ниже чтобы открыть приложение:",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer(f"Роль: {role_name}")


# ==================== CREATE ORDER FROM BOT ====================

@router.message(Command("order"))
@router.callback_query(F.data == "create_order")
async def start_order_creation(event, state: FSMContext):
    """Start order creation from bot"""
    message = event.message if isinstance(event, CallbackQuery) else event
    user_id = event.from_user.id
    
    # Check if user is registered (has phone in database)
    user = await get_user(user_id)
    if not user or not user[5]:  # user[5] is phone
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="📱 Зарегистрироваться",
                url=WEBAPP_URL
            )],
        ])
        text = (
            "❌ <b>Требуется регистрация</b>\n\n"
            "Для создания заявки нужно сначала зарегистрироваться в приложении."
        )
        if isinstance(event, CallbackQuery):
            await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
            await event.answer()
        else:
            await message.answer(text, reply_markup=keyboard, parse_mode="HTML")
        return
    
    # Build currency keyboard
    buttons = []
    row = []
    for code, name in CURRENCIES.items():
        row.append(InlineKeyboardButton(text=name, callback_data=f"from_curr_{code}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_order")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    await state.set_state(BotOrderStates.choosing_from_currency)
    
    text = (
        "💱 <b>Создание заявки на обмен</b>\n\n"
        "Выберите валюту, которую <b>ОТДАЁТЕ</b>:"
    )
    
    if isinstance(event, CallbackQuery):
        await message.edit_text(text, reply_markup=keyboard, parse_mode="HTML")
        await event.answer()
    else:
        await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


@router.callback_query(F.data.startswith("from_curr_"), BotOrderStates.choosing_from_currency)
async def on_from_currency_selected(callback: CallbackQuery, state: FSMContext):
    from_currency = callback.data.split("_")[2]
    await state.update_data(from_currency=from_currency)
    await state.set_state(BotOrderStates.choosing_to_currency)
    
    # Build keyboard excluding selected currency
    buttons = []
    row = []
    for code, name in CURRENCIES.items():
        if code != from_currency:
            row.append(InlineKeyboardButton(text=name, callback_data=f"to_curr_{code}"))
            if len(row) == 2:
                buttons.append(row)
                row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_order")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    await callback.message.edit_text(
        f"💱 <b>Отдаёте:</b> {CURRENCIES[from_currency]}\n\n"
        f"Выберите валюту, которую <b>ПОЛУЧАЕТЕ</b>:",
        reply_markup=keyboard,
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("to_curr_"), BotOrderStates.choosing_to_currency)
async def on_to_currency_selected(callback: CallbackQuery, state: FSMContext):
    to_currency = callback.data.split("_")[2]
    data = await state.get_data()
    await state.update_data(to_currency=to_currency)
    await state.set_state(BotOrderStates.entering_amount)
    
    await callback.message.edit_text(
        f"💱 <b>Обмен:</b> {data['from_currency']} → {to_currency}\n\n"
        f"Введите сумму в <b>{data['from_currency']}</b>:",
        parse_mode="HTML"
    )
    await callback.answer()


@router.message(BotOrderStates.entering_amount)
async def on_amount_entered(message: Message, state: FSMContext):
    try:
        amount = float(message.text.replace(',', '.').replace(' ', ''))
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except ValueError:
        await message.answer("❌ Введите корректную сумму (например: 100)")
        return
    
    await state.update_data(amount=amount)
    await state.set_state(BotOrderStates.entering_location)
    
    # Build location keyboard
    buttons = []
    for loc_id, loc_name in LOCATIONS.items():
        buttons.append([InlineKeyboardButton(text=loc_name, callback_data=f"loc_{loc_id}")])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_order")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    data = await state.get_data()
    await message.answer(
        f"💱 <b>Обмен:</b> {data['from_currency']} → {data['to_currency']}\n"
        f"💰 <b>Сумма:</b> {amount} {data['from_currency']}\n\n"
        f"📍 Выберите ваше местоположение:",
        reply_markup=keyboard,
        parse_mode="HTML"
    )


@router.callback_query(F.data.startswith("loc_"), BotOrderStates.entering_location)
async def on_location_selected(callback: CallbackQuery, state: FSMContext, bot: Bot):
    loc_id = callback.data.split("_")[1]
    
    if loc_id == "other":
        await callback.message.edit_text(
            "📍 Введите ваше местоположение:",
            parse_mode="HTML"
        )
        await callback.answer()
        return
    
    location = LOCATIONS[loc_id].replace("📍 ", "")
    await state.update_data(location=location)
    await finalize_order(callback, state, bot)


@router.message(BotOrderStates.entering_location)
async def on_custom_location(message: Message, state: FSMContext, bot: Bot):
    location = message.text.strip()
    if len(location) < 2:
        await message.answer("❌ Введите корректный адрес")
        return
    
    await state.update_data(location=location)
    await finalize_order(message, state, bot)


async def finalize_order(event, state: FSMContext, bot: Bot):
    """Create order and notify exchangers"""
    data = await state.get_data()
    message = event.message if isinstance(event, CallbackQuery) else event
    user_id = event.from_user.id
    
    # Create order in database
    order_id = await create_order(
        user_id=user_id,
        amount=data['amount'],
        currency=f"{data['from_currency']}→{data['to_currency']}",
        location=data['location'],
        delivery_type='pickup'
    )
    
    await state.clear()
    
    if isinstance(event, CallbackQuery):
        await event.answer("✅ Заявка создана!")
    
    # Send confirmation to user
    confirmation_text = (
        f"✅ <b>Заявка #{order_id} создана!</b>\n\n"
        f"💱 <b>Обмен:</b> {data['from_currency']} → {data['to_currency']}\n"
        f"💰 <b>Сумма:</b> {data['amount']} {data['from_currency']}\n"
        f"📍 <b>Место:</b> {data['location']}\n\n"
        f"Ожидайте предложений от обменников. "
        f"Уведомления придут сюда."
    )
    
    await message.answer(confirmation_text, parse_mode="HTML")
    
    # Notify all exchangers
    await notify_exchangers_new_order(bot, order_id, data, user_id)


async def notify_exchangers_new_order(bot: Bot, order_id: int, order_data: dict, client_id: int):
    """Notify all exchangers about new order with Accept/Reject buttons"""
    from bot.database.database import is_order_dismissed
    
    exchangers = await get_exchangers_by_location(order_data.get('location'))
    
    for exchanger in exchangers:
        if exchanger['telegram_id'] == client_id:
            continue  # Don't notify the client themselves
        
        # Check if exchanger dismissed this order before
        if await is_order_dismissed(exchanger['telegram_id'], order_id):
            continue
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Взять", 
                    callback_data=f"bid_order:{order_id}"
                ),
                InlineKeyboardButton(
                    text="❌ Не брать", 
                    callback_data=f"dismiss_order:{order_id}"
                )
            ],
        ])
        
        text = (
            f"🔔 <b>Новая заявка #{order_id}</b>\n\n"
            f"💱 <b>Обмен:</b> {order_data['from_currency']} → {order_data['to_currency']}\n"
            f"💰 <b>Сумма:</b> {order_data['amount']} {order_data['from_currency']}\n"
            f"📍 <b>Место:</b> {order_data['location']}\n\n"
            f"Хотите взять этот заказ?"
        )
        
        try:
            await bot.send_message(
                chat_id=exchanger['telegram_id'],
                text=text,
                reply_markup=keyboard,
                parse_mode="HTML"
            )
        except Exception as e:
            logging.error(f"Failed to notify exchanger {exchanger['telegram_id']}: {e}")


# ==================== DISMISS ORDER ====================

@router.callback_query(F.data.startswith("dismiss_order:"))
async def on_dismiss_order(callback: CallbackQuery):
    """Exchanger dismisses an order - it disappears for them"""
    order_id = int(callback.data.split(":")[1])
    exchanger_id = callback.from_user.id
    
    from bot.database.database import dismiss_order
    await dismiss_order(exchanger_id, order_id)
    
    # Delete the notification message
    try:
        await callback.message.delete()
    except Exception as e:
        logging.warning(f"Failed to delete dismissed order message: {e}")
    
    await callback.answer("✅ Заказ убран из списка", show_alert=False)


# ==================== EXCHANGER BIDS ====================

@router.callback_query(F.data.startswith("bid_order:"))
async def start_bid(callback: CallbackQuery, state: FSMContext):
    """Exchanger starts making a bid"""
    order_id = int(callback.data.split(":")[1])
    order = await get_order(order_id)
    
    if not order:
        await callback.answer("❌ Заявка не найдена", show_alert=True)
        return
    
    if order['status'] != 'active':
        await callback.answer("❌ Заявка уже закрыта", show_alert=True)
        return
    
    await state.update_data(order_id=order_id, order=dict(order))
    await state.set_state(BidStates.waiting_for_rate)
    
    await callback.message.reply(
        f"💰 <b>Заявка #{order_id}</b>\n\n"
        f"💱 {order['currency']}\n"
        f"Сумма: {order['amount']}\n"
        f"Место: {order['location']}\n\n"
        f"Введите ваш курс обмена (например: 47.50):",
        parse_mode="HTML"
    )
    await callback.answer()


@router.message(BidStates.waiting_for_rate)
async def on_bid_rate(message: Message, state: FSMContext):
    """Handle bid rate input"""
    try:
        rate = float(message.text.replace(',', '.').replace(' ', ''))
        if rate <= 0:
            raise ValueError()
    except ValueError:
        await message.answer("❌ Введите корректный курс (например: 47.50)")
        return
    
    await state.update_data(rate=rate)
    await state.set_state(BidStates.waiting_for_comment)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⏭ Пропустить", callback_data="skip_comment")]
    ])
    
    await message.answer(
        f"💰 Курс: <b>{rate}</b>\n\n"
        f"Добавьте комментарий к предложению (или нажмите Пропустить):",
        reply_markup=keyboard,
        parse_mode="HTML"
    )


@router.callback_query(F.data == "skip_comment", BidStates.waiting_for_comment)
async def skip_comment(callback: CallbackQuery, state: FSMContext, bot: Bot):
    await state.update_data(comment="")
    await submit_bid(callback, state, bot)
    await callback.answer()


@router.message(BidStates.waiting_for_comment)
async def on_bid_comment(message: Message, state: FSMContext, bot: Bot):
    await state.update_data(comment=message.text)
    await submit_bid(message, state, bot)


async def submit_bid(event, state: FSMContext, bot: Bot):
    """Submit the bid and notify client with Uber-like notification"""
    data = await state.get_data()
    user_id = event.from_user.id
    message = event.message if isinstance(event, CallbackQuery) else event
    
    # Get exchanger info for rating display
    exchanger = await get_user(user_id)
    exchanger_name = exchanger[2] if exchanger and exchanger[2] else f"Обменник #{user_id}"
    rating = exchanger[7] if exchanger and len(exchanger) > 7 and exchanger[7] else 5.0
    
    # Save bid
    bid_id = await place_bid(
        order_id=data['order_id'],
        exchanger_id=user_id,
        rate=data['rate'],
        time_estimate="15 мин",
        comment=data.get('comment', '')
    )
    
    await state.clear()
    
    await message.answer(
        f"✅ <b>Предложение отправлено!</b>\n\n"
        f"📄 Заявка #{data['order_id']}\n"
        f"💰 Курс: {data['rate']}\n\n"
        f"Ожидайте ответа клиента. Если он примет ваше предложение - вы получите уведомление.",
        parse_mode="HTML"
    )
    
    # Notify client about new bid (Uber-like notification)
    order = data['order']
    client_id = order['user_id']
    
    # Кнопки: принять предложение + открыть чат
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="✅ Принять предложение", 
            callback_data=f"accept_bid:{bid_id}"
        )],
        [InlineKeyboardButton(
            text=f"💬 Написать {exchanger_name}",
            url=f"tg://user?id={user_id}"
        )],
    ])
    
    notify_text = (
        f"🔔 <b>Новое предложение!</b>\n\n"
        f"━━━━━━━━━━━━━━━\n"
        f"👤 <b>{exchanger_name}</b>\n"
        f"⭐ Рейтинг: {rating:.1f}\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"💰 <b>Курс: {data['rate']}</b>\n"
    )
    
    if data.get('comment'):
        notify_text += f"💬 Комментарий: {data['comment']}\n"
    
    notify_text += f"\n📄 Заявка #{data['order_id']}"
    
    try:
        sent_msg = await bot.send_message(
            chat_id=client_id,
            text=notify_text,
            reply_markup=keyboard,
            parse_mode="HTML"
        )
        # Save message_id for smart deletion later
        await update_bid_message_id(bid_id, sent_msg.message_id)
    except Exception as e:
        logging.error(f"Failed to notify client {client_id}: {e}")


# ==================== ACCEPT BID ====================

@router.callback_query(F.data.startswith("accept_bid:"))
async def on_accept_bid(callback: CallbackQuery, bot: Bot):
    """Client accepts a bid - Uber-like flow"""
    bid_id = int(callback.data.split(":")[1])
    client_id = callback.from_user.id
    
    # Accept bid in database
    bid = await accept_bid(bid_id)
    
    if not bid:
        await callback.answer("❌ Предложение не найдено или уже обработано", show_alert=True)
        return
    
    order = await get_order(bid['order_id'])
    exchanger = await get_user(bid['exchanger_id'])
    client = await get_user(client_id)
    
    exchanger_username = exchanger[2] if exchanger and exchanger[2] else None
    exchanger_name = exchanger_username or f"Обменник #{bid['exchanger_id']}"
    exchanger_phone = exchanger[5] if exchanger and len(exchanger) > 5 else None
    client_phone = client[5] if client and len(client) > 5 else None
    client_name = client[2] if client and client[2] else f"Клиент #{client_id}"
    
    # ==== UPDATE CLIENT'S MESSAGE (the one they clicked) ====
    contact_info = f"👤 <b>{exchanger_name}</b>\n"
    if exchanger_username:
        contact_info += f"📱 @{exchanger_username.replace('@', '')}\n"
    if exchanger_phone:
        contact_info += f"📞 {exchanger_phone}\n"
    
    client_keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"💬 Написать {exchanger_name}",
            url=f"tg://user?id={bid['exchanger_id']}"
        )],
    ])
    
    await callback.message.edit_text(
        f"✅ <b>Предложение принято!</b>\n\n"
        f"━━━━━━━━━━━━━━━\n"
        f"{contact_info}"
        f"━━━━━━━━━━━━━━━\n\n"
        f"💰 Курс: <b>{bid['rate']}</b>\n"
        f"📄 Заявка #{bid['order_id']}\n\n"
        f"Свяжитесь с обменником для завершения сделки.",
        reply_markup=client_keyboard,
        parse_mode="HTML"
    )
    
    # ==== NOTIFY EXCHANGER - THEY GOT THE DEAL! ====
    exchanger_keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"💬 Написать {client_name}",
            url=f"tg://user?id={client_id}"
        )],
    ])
    
    client_contact = f"👤 <b>{client_name}</b>\n"
    if client_phone:
        client_contact += f"📞 {client_phone}\n"
    
    notify_text = (
        f"🎉 <b>Ваше предложение принято!</b>\n\n"
        f"━━━━━━━━━━━━━━━\n"
        f"📄 Заявка #{bid['order_id']}\n"
        f"💱 {order['currency']}\n"
        f"💰 Сумма: {order['amount']}\n"
        f"📍 {order['location']}\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"<b>Контакты клиента:</b>\n"
        f"{client_contact}\n"
        f"Свяжитесь с клиентом для завершения сделки!"
    )
    
    try:
        await bot.send_message(
            chat_id=bid['exchanger_id'],
            text=notify_text,
            reply_markup=exchanger_keyboard,
            parse_mode="HTML"
        )
    except Exception as e:
        logging.error(f"Failed to notify exchanger: {e}")
    
    # ==== SMART DELETION: Delete other bid notifications from client's chat ====
    rejected_bids = await get_rejected_bids_with_messages(bid['order_id'], bid_id)
    for rejected_bid in rejected_bids:
        if rejected_bid['message_id']:
            try:
                await bot.delete_message(
                    chat_id=client_id,
                    message_id=rejected_bid['message_id']
                )
            except Exception as e:
                logging.warning(f"Failed to delete rejected bid message: {e}")
        
        # Notify rejected exchanger
        try:
            await bot.send_message(
                chat_id=rejected_bid['exchanger_id'],
                text=f"❌ К сожалению, заявка #{rejected_bid['order_id']} закрыта.\n"
                     f"Клиент выбрал другого обменника.",
                parse_mode="HTML"
            )
        except Exception as e:
            logging.warning(f"Failed to notify rejected exchanger: {e}")
    
    await callback.answer("✅ Обменник выбран!")


@router.callback_query(F.data == "cancel_order")
async def cancel_order_creation(callback: CallbackQuery, state: FSMContext):
    """Cancel order creation"""
    await state.clear()
    await callback.message.edit_text("❌ Создание заявки отменено.")
    await callback.answer()


@router.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: CallbackQuery):
    """Go back to main menu"""
    from bot.keyboards.main_menu import get_main_menu_keyboard
    user = await get_user(callback.from_user.id)
    lang = user[2] if user else "ru"
    
    await callback.message.edit_text(
        "📱 Главное меню:",
        reply_markup=get_main_menu_keyboard(callback.from_user.id, lang)
    )
    await callback.answer()

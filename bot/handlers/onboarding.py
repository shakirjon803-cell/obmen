from aiogram import Router, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from bot.states.states import RegistrationState
from bot.database.database import (
    get_user_by_telegram_id, 
    check_nickname_exists, 
    register_user_via_bot
)
from bot.keyboards.main_menu import get_main_menu_keyboard
from bot.keyboards.onboarding import get_language_keyboard

router = Router()

# ============= LOCALIZATION =============

TEXTS = {
    "ru": {
        "welcome_new": "👋 Добро пожаловать в NellX!\n\nДавайте создадим ваш аккаунт.\n\n📝 Введите желаемый **никнейм** (логин):",
        "welcome_back": "👋 С возвращением в NellX!\n\n📱 Нажмите кнопку ниже чтобы открыть приложение:",
        "nickname_taken": "❌ Этот никнейм уже занят. Попробуйте другой:",
        "nickname_short": "❌ Никнейм должен быть минимум 3 символа:",
        "nickname_ok": "✅ Отлично! Никнейм `{nickname}` свободен.\n\n🔐 Теперь введите **пароль** (минимум 4 символа):",
        "password_short": "❌ Пароль должен быть минимум 4 символа:",
        "registration_complete": """✅ Регистрация завершена!

━━━━━━━━━━━━━━━━━

📋 **Ваши данные для входа:**

🆔 Логин: `{nickname}`
🔐 Пароль: `{password}`

━━━━━━━━━━━━━━━━━

👆 *Нажмите на данные выше, чтобы скопировать*

Теперь откройте приложение и войдите!""",
        "open_app": "📱 Открыть NellX",
        "seller_code": "🏪 Ваш код продавца:\n\n<code>{code}</code>\n\nВведите на сайте, чтобы стать обменником.",
        "choose_lang": "🌐 Выберите язык / Tilni tanlang:",
    },
    "uz": {
        "welcome_new": "👋 NellX ga xush kelibsiz!\n\nHisobingizni yaratamiz.\n\n📝 Kerakli **nikneym** (login) kiriting:",
        "welcome_back": "👋 Xush kelibsiz!",
        "nickname_taken": "❌ Bu nikneym band. Boshqasini kiriting:",
        "nickname_short": "❌ Nikneym kamida 3 ta belgi bo'lishi kerak:",
        "nickname_ok": "✅ Ajoyib! `{nickname}` nikneymi bo'sh.\n\n🔐 Endi **parol** kiriting (kamida 4 ta belgi):",
        "password_short": "❌ Parol kamida 4 ta belgi bo'lishi kerak:",
        "registration_complete": """✅ Ro'yxatdan o'tish yakunlandi!

━━━━━━━━━━━━━━━━━

📋 **Kirish uchun ma'lumotlar:**

🆔 Login: `{nickname}`
🔐 Parol: `{password}`

━━━━━━━━━━━━━━━━━

👆 *Nusxa olish uchun bosing*

Ilovani oching va kiring!""",
        "open_app": "📱 NellX ni ochish",
        "seller_code": "🏪 Sotuvchi kodingiz:\n\n<code>{code}</code>\n\nBuni saytda kiriting.",
        "choose_lang": "🌐 Tilni tanlang / Выберите язык:",
    },
}


def tr(lang: str, key: str, **kwargs) -> str:
    """Get translated text with optional formatting"""
    text = TEXTS.get(lang, TEXTS["ru"]).get(key, TEXTS["ru"].get(key, ""))
    if kwargs:
        return text.format(**kwargs)
    return text


# ============= /START COMMAND =============

@router.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    """Main entry point - check if user exists or start registration"""
    user = await get_user_by_telegram_id(message.from_user.id)
    
    if user:
        # User exists - show main menu
        lang = user.get("language", "ru")
        await state.clear()
        await message.answer(
            tr(lang, "welcome_back"),
            reply_markup=get_main_menu_keyboard(message.from_user.id, lang)
        )
    else:
        # New user - start registration FSM
        # First, ask for language
        await message.answer(
            tr("ru", "choose_lang"),
            reply_markup=get_language_keyboard()
        )


@router.callback_query(F.data.startswith("lang_"))
async def process_language(callback: types.CallbackQuery, state: FSMContext):
    """Handle language selection and start nickname input"""
    lang = callback.data.split("_")[1]
    await state.update_data(language=lang)
    
    await callback.message.delete()
    await callback.message.answer(
        tr(lang, "welcome_new"),
        parse_mode="Markdown"
    )
    await state.set_state(RegistrationState.waiting_for_nickname)


# ============= NICKNAME INPUT =============

@router.message(RegistrationState.waiting_for_nickname)
async def process_nickname(message: types.Message, state: FSMContext):
    """Handle nickname input"""
    data = await state.get_data()
    lang = data.get("language", "ru")
    
    nickname = message.text.strip().lower().replace(" ", "")
    
    # Validate length
    if len(nickname) < 3:
        await message.answer(tr(lang, "nickname_short"))
        return
    
    # Check if already taken
    if await check_nickname_exists(nickname):
        await message.answer(tr(lang, "nickname_taken"))
        return
    
    # Nickname is good - save and ask for password
    await state.update_data(nickname=nickname)
    await message.answer(
        tr(lang, "nickname_ok", nickname=nickname),
        parse_mode="Markdown"
    )
    await state.set_state(RegistrationState.waiting_for_password)


# ============= PASSWORD INPUT =============

@router.message(RegistrationState.waiting_for_password)
async def process_password(message: types.Message, state: FSMContext):
    """Handle password input and complete registration"""
    data = await state.get_data()
    lang = data.get("language", "ru")
    nickname = data.get("nickname")
    
    password = message.text.strip()
    
    # Validate length
    if len(password) < 4:
        await message.answer(tr(lang, "password_short"))
        return
    
    # Delete the password message for security
    try:
        await message.delete()
    except:
        pass
    
    # Register user in database
    result = await register_user_via_bot(
        telegram_id=message.from_user.id,
        nickname=nickname,
        password=password,
        language=lang
    )
    
    if result.get("error"):
        await message.answer(f"❌ Ошибка: {result['error']}")
        return
    
    # Build open app button
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    import os
    webapp_url = os.getenv("WEBAPP_URL", "https://localhost:8080")
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=tr(lang, "open_app"),
            web_app=WebAppInfo(url=webapp_url)
        )]
    ])
    
    # Send completion message with copyable credentials
    await message.answer(
        tr(lang, "registration_complete", nickname=nickname, password=password),
        parse_mode="Markdown",
        reply_markup=kb
    )
    
    # Clear FSM state
    await state.clear()


# ============= SELLER CODE =============

@router.message(Command("seller_code"))
async def cmd_seller_code(message: types.Message):
    """Generate seller verification code"""
    user = await get_user_by_telegram_id(message.from_user.id)
    
    if not user:
        await message.answer("❌ Вы не зарегистрированы. Используйте /start")
        return
    
    lang = user.get("language", "ru")
    
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(message.from_user.id)
    
    await message.answer(
        tr(lang, "seller_code", code=code),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "get_seller_code")
async def callback_seller_code(callback: types.CallbackQuery):
    """Button callback for seller code"""
    user = await get_user_by_telegram_id(callback.from_user.id)
    lang = user.get("language", "ru") if user else "ru"
    
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(callback.from_user.id)
    
    await callback.message.answer(
        tr(lang, "seller_code", code=code),
        parse_mode="HTML"
    )
    await callback.answer()


# ============= LANGUAGE CHANGE =============

@router.callback_query(F.data == "menu_language")
async def change_language_menu(callback: types.CallbackQuery):
    await callback.message.edit_text(
        "Tilni tanlang / Выберите язык:",
        reply_markup=get_language_keyboard()
    )

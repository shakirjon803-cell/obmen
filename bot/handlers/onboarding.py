from aiogram import Router, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from bot.keyboards.onboarding import get_language_keyboard, get_tos_keyboard
from bot.database.database import add_user, get_user, update_user_profile
from bot.keyboards.main_menu import get_main_menu_keyboard
from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

router = Router()

TOS_URL = "https://telegra.ph/Terms-of-Service-12-01"

TEXTS = {
    "ru": {
        "choose_lang": "Добро пожаловать! Выберите язык:",
        "already": "Вы уже зарегистрированы.",
        "tos": "Для продолжения примите условия.",
        "auth_ok": "Готово!",
        "share_contact": "📱 Подтвердите номер телефона",
        "share_contact_desc": "Для верификации аккаунта нажмите кнопку ниже.\n\n⚠️ Это обязательно для безопасности.",
        "code_sent": "✅ Ваш код подтверждения:\n\n🔑 <b>{code}</b>\n\nВведите этот код на сайте.",
        "phone_exists": "❌ Этот номер уже зарегистрирован.",
        "fake_contact": "❌ Ошибка: номер не принадлежит вашему аккаунту Telegram.",
        "seller_code": "🏪 Ваш код продавца:\n\n<b>{code}</b>\n\nВведите на сайте чтобы стать обменником.",
    },
    "uz": {
        "choose_lang": "Xush kelibsiz! Tilni tanlang:",
        "already": "Siz allaqachon ro'yxatdan o'tgansiz.",
        "tos": "Davom etish uchun shartlarni qabul qiling.",
        "auth_ok": "Tayyor!",
        "share_contact": "📱 Telefon raqamingizni tasdiqlang",
        "share_contact_desc": "Hisobni tasdiqlash uchun quyidagi tugmani bosing.",
        "code_sent": "✅ Sizning kodingiz:\n\n🔑 <b>{code}</b>\n\nBu kodni saytda kiriting.",
        "phone_exists": "❌ Bu raqam allaqachon ro'yxatdan o'tgan.",
        "fake_contact": "❌ Xato: raqam sizning Telegram hisobingizga tegishli emas.",
        "seller_code": "🏪 Sotuvchi kodingiz:\n\n<b>{code}</b>",
    },
}


def tr(lang: str, key: str) -> str:
    return TEXTS.get(lang, TEXTS["ru"]).get(key, TEXTS["ru"].get(key, ""))


def get_share_contact_keyboard(lang: str = "ru"):
    """Keyboard with Share Contact button"""
    btn_text = tr(lang, "share_contact")
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=btn_text, request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True
    )


# ============= MAIN VERIFICATION FLOW =============

@router.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    user = await get_user(message.from_user.id)
    lang = user[2] if user else "ru"
    
    # If already verified, show main menu
    if user and user[5]:  # user[5] is phone
        await message.answer(tr(lang, "already"), reply_markup=get_main_menu_keyboard(message.from_user.id, lang))
        return

    await state.set_state(None)
    await message.answer(tr(lang, "choose_lang"), reply_markup=get_language_keyboard())


@router.callback_query(F.data.startswith("lang_"))
async def process_language_change(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.data.split("_")[1]
    await state.update_data(language=lang)
    await add_user(callback.from_user.id, lang)
    
    await callback.message.delete()
    await callback.message.answer(tr(lang, "tos"), reply_markup=get_tos_keyboard(TOS_URL))


@router.callback_query(F.data == "tos_agree")
async def process_tos(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    lang = data.get("language", "ru")
    
    # Show share contact button
    await callback.message.delete()
    await callback.message.answer(
        tr(lang, "share_contact_desc"),
        reply_markup=get_share_contact_keyboard(lang)
    )


# ============= CONTACT VERIFICATION (Security Check) =============

@router.message(F.contact)
async def on_contact_received(message: types.Message, state: FSMContext):
    """Handle contact sharing - SECURITY CHECK"""
    data = await state.get_data()
    lang = data.get("language", "ru")
    
    contact = message.contact
    
    # CRITICAL SECURITY CHECK: Verify contact belongs to sender
    if contact.user_id != message.from_user.id:
        await message.answer(
            tr(lang, "fake_contact"),
            reply_markup=types.ReplyKeyboardRemove()
        )
        return
    
    phone = contact.phone_number
    
    # Check if phone already registered
    from bot.database.database import is_phone_registered
    if await is_phone_registered(phone):
        await message.answer(
            tr(lang, "phone_exists"),
            reply_markup=types.ReplyKeyboardRemove()
        )
        return
    
    # Save user profile
    await update_user_profile(
        message.from_user.id,
        phone,
        message.from_user.username or "",
        message.from_user.full_name
    )
    
    # Generate and send verification code AUTOMATICALLY
    from bot.database.database import generate_bot_verification_code
    code = await generate_bot_verification_code(message.from_user.id, phone)
    
    await message.answer(
        tr(lang, "code_sent").format(code=code),
        parse_mode="HTML",
        reply_markup=types.ReplyKeyboardRemove()
    )
    
    # Show main menu
    await message.answer(
        tr(lang, "auth_ok"),
        reply_markup=get_main_menu_keyboard(message.from_user.id, lang)
    )


# ============= SELLER CODE =============

@router.message(Command("seller_code"))
async def cmd_seller_code(message: types.Message):
    """Generate seller verification code"""
    user = await get_user(message.from_user.id)
    lang = user[2] if user else "ru"
    
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(message.from_user.id)
    
    await message.answer(
        tr(lang, "seller_code").format(code=code),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "get_seller_code")
async def callback_seller_code(callback: types.CallbackQuery):
    """Button callback for seller code"""
    user = await get_user(callback.from_user.id)
    lang = user[2] if user else "ru"
    
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(callback.from_user.id)
    
    await callback.message.answer(
        tr(lang, "seller_code").format(code=code),
        parse_mode="HTML"
    )
    await callback.answer()


# ============= LANGUAGE CHANGE =============

@router.callback_query(F.data == "menu_language")
async def change_language_menu(callback: types.CallbackQuery):
    await callback.message.edit_text("Tilni tanlang / Выберите язык:", reply_markup=get_language_keyboard())

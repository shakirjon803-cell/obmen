import os
import json
import logging
import asyncio
from aiohttp import web, WSMsgType
from bot.database.database import (
    get_user, update_user_role, create_order, get_active_orders, 
    get_user_orders, place_bid, get_order_bids, create_market_post, get_market_posts,
    verify_seller_code
)

# WebSocket clients for real-time updates
ws_clients = set()

async def broadcast_update(event_type: str, data: dict):
    """Broadcast update to all connected WebSocket clients"""
    message = json.dumps({"type": event_type, "data": data})
    disconnected = set()
    for ws in ws_clients:
        try:
            await ws.send_str(message)
        except:
            disconnected.add(ws)
    ws_clients.difference_update(disconnected)

# Middleware to log all requests
@web.middleware
async def log_requests(request, handler):
    logging.info(f"Incoming request: {request.method} {request.path}")
    return await handler(request)

routes = web.RouteTableDef()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_DIST_DIR = os.path.join(BASE_DIR, 'client', 'dist')

@routes.get('/ws')
async def websocket_handler(request):
    """WebSocket endpoint for real-time updates"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    ws_clients.add(ws)
    logging.info(f"WebSocket client connected. Total: {len(ws_clients)}")
    
    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                # Handle incoming messages if needed
                pass
            elif msg.type == WSMsgType.ERROR:
                logging.error(f'WebSocket error: {ws.exception()}')
    finally:
        ws_clients.discard(ws)
        logging.info(f"WebSocket client disconnected. Total: {len(ws_clients)}")
    
    return ws

@routes.get('/')
async def handle_index(request):
    path = os.path.join(CLIENT_DIST_DIR, 'index.html')
    logging.info(f"Attempting to serve index from: {path}")
    if not os.path.exists(path):
        logging.error(f"File not found: {path}")
        return web.Response(text=f"Error: Index file not found at {path}. Please build the client app.", status=404)
    return web.FileResponse(path)

# Serve static assets
routes.static('/assets', os.path.join(CLIENT_DIST_DIR, 'assets'))

@routes.get('/api/init')
async def handle_init(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    user = await get_user(int(user_id))
    if user:
        try:
            role = user[6]
        except IndexError:
            role = None
        return web.json_response({'role': role})
    return web.json_response({'role': None})

@routes.post('/api/role')
async def handle_set_role(request):
    data = await request.json()
    user_id = data.get('user_id')
    role = data.get('role')
    await update_user_role(int(user_id), role)
    return web.json_response({'status': 'ok'})

import time
RATE_LIMITS = {}

# ============= NEW AUTH ENDPOINTS =============

@routes.post('/api/auth/check-nickname')
async def handle_check_nickname(request):
    """Check if nickname is available"""
    data = await request.json()
    nickname = data.get('nickname', '')
    
    if not nickname or len(nickname) < 3:
        return web.json_response({'available': False, 'error': 'too_short'})
    
    from bot.database.database import check_nickname_exists
    exists = await check_nickname_exists(nickname)
    return web.json_response({'available': not exists})

@routes.post('/api/auth/register')
async def handle_register(request):
    """Register new account with nickname and password"""
    data = await request.json()
    nickname = data.get('nickname', '').strip()
    name = data.get('name', '').strip()
    password = data.get('password', '')
    telegram_id = data.get('telegram_id')  # From Telegram WebApp initData
    
    if not nickname or len(nickname) < 3:
        return web.json_response({'error': 'nickname_too_short'}, status=400)
    if not password or len(password) < 4:
        return web.json_response({'error': 'password_too_short'}, status=400)
    
    from bot.database.database import register_web_account
    result = await register_web_account(nickname, name or nickname, password)
    
    if 'error' in result:
        return web.json_response(result, status=400)
    
    logging.info(f"New account registered: {nickname}, code: {result['code']}")
    
    # AUTO-SEND code to Telegram if telegram_id provided
    if telegram_id:
        bot = request.app.get('bot')
        if bot:
            try:
                await bot.send_message(
                    int(telegram_id),
                    f"🔐 <b>NellX - Код подтверждения</b>\n\n"
                    f"Ваш код: <code>{result['code']}</code>\n\n"
                    f"Введите этот код на сайте для завершения регистрации.",
                    parse_mode="HTML"
                )
                logging.info(f"Verification code sent to {telegram_id}")
            except Exception as e:
                logging.error(f"Failed to send code to {telegram_id}: {e}")
    
    return web.json_response(result)

@routes.post('/api/auth/login')
async def handle_login(request):
    """Login with nickname and password"""
    data = await request.json()
    nickname = data.get('nickname', '').strip()
    password = data.get('password', '')
    
    from bot.database.database import login_web_account
    result = await login_web_account(nickname, password)
    
    if 'error' in result:
        return web.json_response(result, status=401)
    
    return web.json_response(result)

@routes.post('/api/auth/check-verified')
async def handle_check_verified(request):
    """Check if verification code was verified by bot"""
    data = await request.json()
    code = data.get('code', '')
    
    from bot.database.database import check_code_verified
    result = await check_code_verified(code)
    return web.json_response(result)

@routes.post('/api/auth/request-seller-code')
async def handle_request_seller_code(request):
    """Request seller code - auto-sends to Telegram"""
    data = await request.json()
    telegram_id = data.get('telegram_id')
    
    if not telegram_id:
        return web.json_response({'error': 'missing_telegram_id'}, status=400)
    
    from bot.database.database import generate_seller_code
    code = await generate_seller_code(int(telegram_id))
    
    # AUTO-SEND code to Telegram
    bot = request.app.get('bot')
    if bot:
        try:
            await bot.send_message(
                int(telegram_id),
                f"🏪 <b>NellX - Код обменника</b>\n\n"
                f"Ваш код: <code>{code}</code>\n\n"
                f"Введите этот код на сайте чтобы стать обменником.",
                parse_mode="HTML"
            )
            logging.info(f"Seller code sent to {telegram_id}")
            return web.json_response({'success': True, 'code_sent': True})
        except Exception as e:
            error_msg = str(e).lower()
            logging.error(f"Failed to send seller code to {telegram_id}: {e}")
            # Check if bot is blocked
            if 'blocked' in error_msg or 'forbidden' in error_msg or 'chat not found' in error_msg:
                return web.json_response({'error': 'BOT_BLOCKED'}, status=400)
            return web.json_response({'error': 'send_failed'}, status=500)
    
    return web.json_response({'error': 'bot_not_available'}, status=500)


@routes.post('/api/auth/verify-seller')
async def handle_verify_seller(request):
    """Verify seller code and upgrade account"""
    data = await request.json()
    code = data.get('code', '').strip()
    account_id = data.get('account_id')
    telegram_id = data.get('telegram_id')
    
    if not code:
        return web.json_response({'error': 'missing_code'}, status=400)
    
    if not account_id and not telegram_id:
        return web.json_response({'error': 'missing_id'}, status=400)
    
    success = await verify_seller_code(code, account_id=account_id, telegram_id=telegram_id)
    
    if success:
        return web.json_response({'success': True})
    return web.json_response({'error': 'invalid_code'}, status=400)

@routes.post('/api/auth/verify-code')
async def handle_verify_code_from_site(request):
    """User enters code from bot to verify account"""
    data = await request.json()
    code = data.get('code', '').strip()
    account_id = data.get('account_id')
    
    if not code:
        return web.json_response({'error': 'missing_code'}, status=400)
    
    from bot.database.database import verify_bot_code
    result = await verify_bot_code(code, account_id)
    
    if result.get('success'):
        return web.json_response({'success': True})
    return web.json_response({'error': 'invalid_code'}, status=400)

# ============= LEGACY ENDPOINTS (keep for compatibility) =============

@routes.post('/api/auth/generate-code')
async def handle_generate_code(request):
    """Legacy: Generate verification code"""
    data = await request.json()
    user_id = data.get('user_id')
    name = data.get('name', '')
    
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)

    import random
    code = f"{random.randint(100000, 999999)}"
    
    from bot.database.database import add_user, save_verification_code_by_user
    await add_user(int(user_id), 'ru')
    await save_verification_code_by_user(int(user_id), code, f"pending_{user_id}")
    
    logging.info(f"Generated code {code} for user {user_id}")
    return web.json_response({'status': 'ok', 'code': code})

@routes.post('/api/user/update')
async def handle_update_user(request):
    data = await request.json()
    user_id = data.get('user_id')
    phone = data.get('phone')
    username = data.get('username')
    name = data.get('name')

    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)

    from bot.database.database import update_user_profile
    await update_user_profile(user_id, phone, username, name)
    await update_user_profile(user_id, phone, username, name)
    return web.json_response({'status': 'ok'})

@routes.post('/api/user/avatar')
async def handle_update_avatar(request):
    """Update user avatar"""
    data = await request.json()
    account_id = data.get('account_id')
    avatar_url = data.get('avatar_url')
    original_avatar_url = data.get('original_avatar_url')  # Full-size original for re-editing
    
    if not account_id:
        return web.json_response({'error': 'Missing account_id'}, status=400)
    
    from bot.database.database import update_avatar
    await update_avatar(int(account_id), avatar_url, original_avatar_url)
    return web.json_response({'status': 'ok'})

@routes.get('/api/account')
async def handle_get_account(request):
    """Get account data by account_id - used to load avatar after login"""
    account_id = request.query.get('account_id')
    if not account_id:
        return web.json_response({'error': 'Missing account_id'}, status=400)
    
    from bot.database.database import get_account_by_id
    account = await get_account_by_id(int(account_id))
    
    if not account:
        return web.json_response({'error': 'Account not found'}, status=404)
    
    return web.json_response({
        'id': account.get('id'),
        'name': account.get('name'),
        'nickname': account.get('nickname'),
        'avatar_url': account.get('avatar_url'),
        'original_avatar_url': account.get('original_avatar_url'),
        'role': account.get('role'),
        'telegram_id': account.get('telegram_id')
    })

@routes.get('/api/user/stats')
async def handle_get_stats(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
        
    from bot.database.database import get_user_stats
    stats = await get_user_stats(int(user_id))
    return web.json_response(stats)

@routes.post('/api/orders')
async def handle_create_order(request):
    data = await request.json()
    
    # Ensure user has synced data from web_account (phone, name)
    from bot.database.database import sync_user_from_web_account
    await sync_user_from_web_account(int(data['user_id']))
    
    order_id = await create_order(
        int(data['user_id']), 
        float(data['amount']), 
        data['currency'], 
        data['location'], 
        data['delivery_type']
    )

    # Notify Exchangers with Uber-like notification
    try:
        from bot.database.database import get_exchangers_by_location
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

        exchangers = await get_exchangers_by_location(data['location'])
        bot = request.app['bot']
        
        for exchanger in exchangers:
            exchanger_id = exchanger['telegram_id']
            
            if exchanger_id != int(data['user_id']): # Don't notify self
                text = (
                    f"🔔 <b>Новая заявка #{order_id}</b>\n\n"
                    f"💰 <b>{data['amount']} {data['currency']}</b>\n"
                    f"📍 {data['location']}\n"
                    f"🚗 {data['delivery_type']}\n\n"
                    f"Хотите взять этот заказ?"
                )
                
                # Uber-style buttons: Take (green) / Don't Take (red)
                kb = InlineKeyboardMarkup(inline_keyboard=[
                    [
                        InlineKeyboardButton(text="✅ Взять", callback_data=f"bid_order:{order_id}"),
                        InlineKeyboardButton(text="❌ Не брать", callback_data=f"dismiss_order:{order_id}")
                    ],
                ])

                try:
                    await bot.send_message(chat_id=exchanger_id, text=text, reply_markup=kb, parse_mode="HTML")
                except Exception as e:
                    logging.warning(f"Failed to notify exchanger {exchanger_id}: {e}")

    except Exception as e:
        logging.error(f"Notification error: {e}")

    # Broadcast to WebSocket clients for real-time update
    await broadcast_update('new_order', {
        'id': order_id,
        'amount': data['amount'],
        'currency': data['currency'],
        'location': data['location'],
        'user_id': int(data['user_id'])
    })

    return web.json_response({'id': order_id, 'status': 'ok'})

@routes.get('/api/orders/active')
async def handle_get_active_orders(request):
    orders = await get_active_orders()
    return web.json_response(orders)

@routes.get('/api/orders/my')
async def handle_get_my_orders(request):
    user_id = request.query.get('user_id')
    orders = await get_user_orders(int(user_id))
    return web.json_response(orders)

@routes.post('/api/orders/{id}/cancel')
async def handle_cancel_order(request):
    order_id = int(request.match_info['id'])
    try:
        from bot.database.database import cancel_order
        await cancel_order(order_id)
        return web.json_response({'status': 'ok'})
    except Exception as e:
        logging.error(f"Failed to cancel order: {e}")
        return web.json_response({'error': str(e)}, status=500)

@routes.post('/api/bids')
async def handle_place_bid(request):
    data = await request.json()
    bid_id = await place_bid(
        int(data['order_id']),
        int(data['exchanger_id']),
        float(data['rate']),
        data.get('time_estimate', '15'),
        data.get('comment', '')
    )
    
    # Notify client with Uber-like notification
    try:
        from bot.database.database import get_order, get_user, update_bid_message_id
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        
        order = await get_order(int(data['order_id']))
        exchanger = await get_user(int(data['exchanger_id']))
        
        exchanger_name = exchanger[2] if exchanger and exchanger[2] else f"Обменник #{data['exchanger_id']}"
        rating = exchanger[7] if exchanger and len(exchanger) > 7 and exchanger[7] else 5.0
        
        client_id = order['user_id']
        exchanger_id = int(data['exchanger_id'])
        
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="✅ Принять предложение", callback_data=f"accept_bid:{bid_id}")],
            [InlineKeyboardButton(text=f"💬 Написать {exchanger_name}", url=f"tg://user?id={exchanger_id}")],
        ])
        
        text = (
            f"🔔 <b>Новое предложение!</b>\n\n"
            f"━━━━━━━━━━━━━━━\n"
            f"👤 <b>{exchanger_name}</b>\n"
            f"⭐ Рейтинг: {rating:.1f}\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"💰 <b>Курс: {data['rate']}</b>\n"
        )
        if data.get('comment'):
            text += f"💬 Комментарий: {data['comment']}\n"
        text += f"\n📄 Заявка #{data['order_id']}"
        
        bot = request.app['bot']
        sent_msg = await bot.send_message(chat_id=client_id, text=text, reply_markup=kb, parse_mode="HTML")
        
        # Save message_id for smart deletion
        await update_bid_message_id(bid_id, sent_msg.message_id)
        
    except Exception as e:
        logging.error(f"Failed to notify client about new bid: {e}")
    
    # Broadcast new bid to WebSocket clients
    await broadcast_update('new_bid', {
        'bid_id': bid_id,
        'order_id': int(data['order_id']),
        'rate': data['rate'],
        'exchanger_id': int(data['exchanger_id'])
    })
    
    return web.json_response({'status': 'ok', 'bid_id': bid_id})

@routes.get('/api/bids/my')
async def handle_get_my_bids(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_user_bids
    bids = await get_user_bids(int(user_id))
    return web.json_response(bids)

@routes.get('/api/bids')
async def handle_get_order_bids(request):
    order_id = request.query.get('order_id')
    if not order_id:
        return web.json_response({'error': 'Missing order_id'}, status=400)
    
    from bot.database.database import get_order_bids
    bids = await get_order_bids(int(order_id))
    return web.json_response(bids)

@routes.delete('/api/bids/completed')
async def handle_clear_completed_bids(request):
    """Clear completed/rejected bids for a user"""
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import clear_completed_bids
    await clear_completed_bids(int(user_id))
    return web.json_response({'status': 'ok'})

@routes.post('/api/bids/{id}/complete')
async def handle_complete_bid(request):
    """Mark a deal as completed - exchanger finishes the deal"""
    bid_id = int(request.match_info['id'])
    
    from bot.database.database import complete_bid, get_order
    
    bid = await complete_bid(bid_id)
    
    if not bid:
        return web.json_response({'error': 'Bid not found'}, status=404)
    
    # Get order details
    order = await get_order(bid['order_id'])
    
    bot = request.app['bot']
    
    # Notify client that deal is complete
    if order:
        try:
            text = (
                f"✅ <b>Сделка завершена!</b>\n\n"
                f"📄 Заявка #{order['id']}\n"
                f"💰 {order['amount']} {order['currency']}\n"
                f"💱 Курс: {bid['rate']}\n\n"
                f"Спасибо за использование NellX!\n"
                f"Оставьте отзыв об обменнике."
            )
            
            await bot.send_message(chat_id=order['user_id'], text=text, parse_mode="HTML")
        except Exception as e:
            logging.error(f"Failed to notify client about completed deal: {e}")
    
    return web.json_response({'status': 'ok'})


@routes.post('/api/bids/{id}/accept')
async def handle_accept_bid(request):
    bid_id = int(request.match_info['id'])
    client_id = request.query.get('client_id')  # optional, for smart deletion
    
    from bot.database.database import accept_bid, get_user, get_order, get_rejected_bids_with_messages
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    
    bid = await accept_bid(bid_id)
    
    if not bid:
        return web.json_response({'error': 'Bid not found'}, status=404)
        
    # Get order and user details
    order = await get_order(bid['order_id'])
    exchanger = await get_user(bid['exchanger_id'])
    
    exchanger_id = bid['exchanger_id']
    exchanger_name = exchanger[2] if exchanger and exchanger[2] else f"Обменник #{exchanger_id}"
    
    order_client_id = order['user_id'] if order else (int(client_id) if client_id else None)
    client = await get_user(order_client_id) if order_client_id else None
    client_name = client[2] if client and client[2] else f"Клиент #{order_client_id}"
    client_phone = client[5] if client and len(client) > 5 else None
    
    bot = request.app['bot']
    
    # Notify Exchanger with chat button
    try:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=f"💬 Написать {client_name}", url=f"tg://user?id={order_client_id}")],
        ])
        
        client_contact = f"👤 <b>{client_name}</b>\n"
        if client_phone:
            client_contact += f"📞 {client_phone}\n"
        
        text = (
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
        
        await bot.send_message(chat_id=exchanger_id, text=text, reply_markup=kb, parse_mode="HTML")
        
    except Exception as e:
        logging.error(f"Failed to notify exchanger about accepted bid: {e}")
    
    # Smart deletion: Delete rejected bids from client's chat
    if order_client_id:
        rejected_bids = await get_rejected_bids_with_messages(bid['order_id'], bid_id)
        for rejected_bid in rejected_bids:
            if rejected_bid['message_id']:
                try:
                    await bot.delete_message(
                        chat_id=order_client_id,
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

    return web.json_response({'status': 'ok', 'order_id': bid['order_id']})

@routes.post('/api/bids/{id}/complete')
async def handle_complete_bid(request):
    """Mark a bid/deal as completed"""
    bid_id = int(request.match_info['id'])
    
    from bot.database.database import complete_bid, get_order_client_id
    
    bid = await complete_bid(bid_id)
    if not bid:
        return web.json_response({'error': 'not_found'}, status=404)
    
    # Notify client that deal is completed
    try:
        order_client_id = await get_order_client_id(bid['order_id'])
        if order_client_id:
            await bot.send_message(
                chat_id=order_client_id,
                text=f"✅ Сделка #{bid['order_id']} завершена!\n\n"
                     f"Спасибо за использование NellX.",
                parse_mode="HTML"
            )
    except Exception as e:
        logging.warning(f"Failed to notify client about completed deal: {e}")
    
    return web.json_response({'status': 'ok'})

@routes.delete('/api/bids/completed')
async def handle_delete_completed_bids(request):
    """Delete all completed/rejected bids for a user (clear archive)"""
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import clear_completed_bids
    await clear_completed_bids(int(user_id))
    
    return web.json_response({'status': 'ok'})

@routes.get('/api/market')
async def handle_get_market(request):
    posts = await get_market_posts()
    return web.json_response(posts)

@routes.post('/api/market')
async def handle_create_post(request):
    data = await request.json()
    await create_market_post(
        int(data['user_id']),
        data.get('type', 'sell'),
        float(data.get('amount', 0) or 0),
        data.get('currency', ''),
        float(data.get('rate', 0) or 0),
        data.get('location', ''),
        data.get('description', ''),
        data.get('category'),
        data.get('image_data'),
        data.get('title')
    )
    return web.json_response({'status': 'ok'})

@routes.get('/api/market/my')
async def handle_get_my_posts(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_user_market_posts
    posts = await get_user_market_posts(int(user_id))
    return web.json_response(posts)

# ============= FAVORITES ENDPOINTS =============

@routes.get('/api/favorites')
async def handle_get_favorites(request):
    """Get all favorites for a user"""
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_user_favorites
    posts = await get_user_favorites(int(user_id))
    return web.json_response(posts)

@routes.get('/api/favorites/ids')
async def handle_get_favorite_ids(request):
    """Get list of favorite post IDs for a user"""
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_user_favorite_ids
    ids = await get_user_favorite_ids(int(user_id))
    return web.json_response(ids)

@routes.post('/api/favorites/{post_id}')
async def handle_add_favorite(request):
    """Add a post to favorites"""
    post_id = int(request.match_info['post_id'])
    data = await request.json()
    user_id = data.get('user_id')
    
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import add_favorite
    await add_favorite(int(user_id), post_id)
    return web.json_response({'status': 'ok'})

@routes.delete('/api/favorites/{post_id}')
async def handle_remove_favorite(request):
    """Remove a post from favorites"""
    post_id = int(request.match_info['post_id'])
    user_id = request.query.get('user_id')
    
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import remove_favorite
    await remove_favorite(int(user_id), post_id)
    return web.json_response({'status': 'ok'})

# ============= REPORTS ENDPOINT =============

@routes.post('/api/reports')
async def handle_create_report(request):
    """Create a report for a user or post"""
    data = await request.json()
    reporter_id = data.get('reporter_id')
    reported_user_id = data.get('reported_user_id')
    post_id = data.get('post_id')
    reason = data.get('reason', '')
    comment = data.get('comment')
    
    if not reporter_id or not reason:
        return web.json_response({'error': 'Missing required fields'}, status=400)
    
    from bot.database.database import create_report
    await create_report(int(reporter_id), reported_user_id, post_id, reason, comment)
    return web.json_response({'status': 'ok'})

# ============= HIDDEN POSTS ENDPOINTS =============

@routes.post('/api/hidden')
async def handle_hide_post(request):
    """Hide a post (Not Interested)"""
    data = await request.json()
    user_id = data.get('user_id')
    post_id = data.get('post_id')
    
    if not user_id or not post_id:
        return web.json_response({'error': 'Missing required fields'}, status=400)
    
    from bot.database.database import hide_post
    await hide_post(int(user_id), int(post_id))
    return web.json_response({'status': 'ok'})

@routes.get('/api/hidden')
async def handle_get_hidden(request):
    """Get list of hidden post IDs"""
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_hidden_post_ids
    ids = await get_hidden_post_ids(int(user_id))
    return web.json_response(ids)

@routes.get('/api/users/{id}')
async def handle_get_user_profile(request):
    """Get user profile by ID"""
    user_id = int(request.match_info['id'])
    
    # Try web_accounts first, then users table
    from bot.database.database import get_web_account_by_telegram_id
    account = await get_web_account_by_telegram_id(user_id)
    
    if account:
        return web.json_response({
            'id': user_id,
            'name': account.get('name') or account.get('nickname', 'User'),
            'avatar_url': account.get('avatar_url'),
            'role': account.get('role', 'client'),
            'rating': 5.0,
            'deals_count': 0
        })
    
    # Fallback to users table
    user = await get_user(user_id)
    if user:
        return web.json_response({
            'id': user_id,
            'name': user[2] or 'User',  # username
            'avatar_url': None,
            'role': user[6] if len(user) > 6 else 'client',
            'rating': user[7] if len(user) > 7 else 5.0,
            'deals_count': user[8] if len(user) > 8 else 0
        })
    
    # Create basic user data if nothing found
    return web.json_response({
        'id': user_id,
        'name': f'User {user_id}',
        'avatar_url': None,
        'role': 'client',
        'rating': 5.0,
        'deals_count': 0
    })

@routes.get('/api/users/{id}/posts')
async def handle_get_user_posts(request):
    """Get posts by user ID"""
    user_id = int(request.match_info['id'])
    from bot.database.database import get_user_market_posts
    posts = await get_user_market_posts(user_id)
    return web.json_response(posts)

@routes.get('/api/users/{id}/reviews')
async def handle_get_user_reviews(request):
    """Get reviews for user"""
    user_id = int(request.match_info['id'])
    from bot.database.database import get_user_reviews
    reviews = await get_user_reviews(user_id)
    return web.json_response(reviews)

@routes.get('/api/posts/{id}')
async def handle_get_post(request):
    """Get single post by ID"""
    post_id = int(request.match_info['id'])
    from bot.database.database import get_market_post
    post = await get_market_post(post_id)
    if not post:
        return web.json_response({'error': 'not_found'}, status=404)
    return web.json_response(post)

@routes.put('/api/market/{id}')
async def handle_update_post(request):
    post_id = int(request.match_info['id'])
    data = await request.json()
    user_id = data.get('user_id')
    
    from bot.database.database import update_market_post
    await update_market_post(
        post_id, 
        int(user_id), 
        float(data.get('amount', 0) or 0), 
        float(data.get('rate', 0) or 0), 
        data.get('description', ''),
        p_type=data.get('type'),
        currency=data.get('currency'),
        location=data.get('location'),
        category=data.get('category'),
        image_data=data.get('image_data'),
        title=data.get('title')
    )
    return web.json_response({'status': 'ok'})

@routes.delete('/api/market/{id}')
async def handle_delete_post(request):
    post_id = int(request.match_info['id'])
    user_id = request.query.get('user_id')
    
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)

    from bot.database.database import delete_market_post
    await delete_market_post(post_id, int(user_id))
    return web.json_response({'status': 'ok'})

@routes.get('/api/categories')
async def handle_get_categories(request):
    from bot.database.database import get_categories
    categories = await get_categories()
    # Default categories + custom ones
    defaults = ['USD', 'BTC', 'UZS']
    all_cats = list(set(defaults + categories))
    return web.json_response(all_cats)

@routes.post('/api/categories')
async def handle_create_category(request):
    data = await request.json()
    name = data.get('name')
    user_id = data.get('user_id')
    
    if not name or not user_id:
        return web.json_response({'error': 'Missing data'}, status=400)

    from bot.database.database import create_category
    success = await create_category(name, int(user_id))
    if success:
        return web.json_response({'status': 'ok'})
    else:
        return web.json_response({'error': 'Category already exists'}, status=400)

@routes.get('/api/config')
async def handle_get_config(request):
    bot = request.app['bot']
    me = await bot.get_me()
    return web.json_response({'bot_username': me.username})

@routes.post('/api/chat/send')
async def handle_send_chat(request):
    """
    Send a Telegram message (with placeholder photo) to target_user_id with order/post data.
    """
    data = await request.json()
    target_user_id = data.get('target_user_id')
    sender_id = data.get('sender_id')
    payload = data.get('payload', {})

    if not target_user_id or not sender_id:
        return web.json_response({'error': 'Missing target_user_id or sender_id'}, status=400)

    bot = request.app['bot']
    # Build caption
    order_id = payload.get('order_id') or payload.get('post_id') or '—'
    name = payload.get('name') or '—'
    phone = payload.get('phone') or '—'
    amount = payload.get('amount') or '—'
    currency = payload.get('currency') or ''
    location = payload.get('location') or '—'
    title = payload.get('title') or 'Запрос'

    caption = (
        f"Новый контакт по заявке #{order_id}\n"
        f"{title}\n"
        f"Сумма: {amount} {currency}\n"
        f"Локация: {location}\n"
        f"Имя: {name}\n"
        f"Телефон: {phone}\n"
        f"Перешли из мини-аппа."
    )

    try:
        await bot.send_photo(
            chat_id=int(target_user_id),
            photo="https://via.placeholder.com/600x320.png?text=Malxam+Order",
            caption=caption
        )
        return web.json_response({'status': 'ok'})
    except Exception as e:
        logging.error(f"Failed to send chat handoff: {e}")
        return web.json_response({'error': 'Failed to send message'}, status=500)

# ============= ALIASES FOR BOLT.AI COMPATIBILITY =============

@routes.get('/api/posts')
async def handle_get_posts_alias(request):
    """Alias for /api/market"""
    posts = await get_market_posts()
    return web.json_response(posts)

@routes.post('/api/posts')
async def handle_create_post_alias(request):
    """Alias for /api/market POST"""
    data = await request.json()
    await create_market_post(
        int(data['user_id']),
        data['type'],
        float(data['amount']),
        data['currency'],
        float(data['rate']),
        data['location'],
        data['description'],
        data.get('category'),
        data.get('image_data')
    )
    return web.json_response({'status': 'ok'})

@routes.get('/api/users/{user_id}/orders')
async def handle_get_user_orders_by_id(request):
    """Get orders for a specific user"""
    user_id = int(request.match_info['user_id'])
    orders = await get_user_orders(user_id)
    return web.json_response(orders)

@routes.get('/api/users/{user_id}/bids')
async def handle_get_user_bids_by_id(request):
    """Get bids for a specific user"""
    user_id = int(request.match_info['user_id'])
    from bot.database.database import get_user_bids
    bids = await get_user_bids(user_id)
    return web.json_response(bids)

# Catch-all for React Router (SPA)
@routes.get('/{tail:.*}')
async def catch_all(request):
    # If it's an API call that wasn't matched, return 404
    if request.path.startswith('/api/'):
        return web.Response(text=f"404 API Not Found: {request.path}", status=404)
    
    # Otherwise serve index.html for client-side routing
    path = os.path.join(CLIENT_DIST_DIR, 'index.html')
    return web.FileResponse(path)

# ============= PROFILE ENDPOINTS =============

@routes.get('/api/users/{user_id}')
async def get_user_profile(request):
    """Get public profile"""
    user_id = int(request.match_info['user_id'])
    from bot.database.database import get_public_profile
    profile = await get_public_profile(user_id)
    if not profile:
        return web.json_response({'error': 'not_found'}, status=404)
    return web.json_response(profile)

@routes.get('/api/users/{user_id}/posts')
async def get_user_posts_endpoint(request):
    """Get all posts by user"""
    user_id = int(request.match_info['user_id'])
    from bot.database.database import get_user_posts
    posts = await get_user_posts(user_id)
    return web.json_response(posts)

@routes.get('/api/users/{user_id}/reviews')
async def get_user_reviews_endpoint(request):
    """Get all reviews for user"""
    user_id = int(request.match_info['user_id'])
    from bot.database.database import get_user_reviews
    reviews = await get_user_reviews(user_id)
    return web.json_response(reviews)

@routes.post('/api/reviews')
async def add_review_endpoint(request):
    """Add a review"""
    data = await request.json()
    from_user = data.get('from_user_id')
    to_user = data.get('to_user_id')
    rating = data.get('rating')
    comment = data.get('comment', '')
    post_id = data.get('post_id')
    
    if not all([from_user, to_user, rating]):
        return web.json_response({'error': 'missing_data'}, status=400)
    
    from bot.database.database import add_review
    await add_review(from_user, to_user, rating, comment, post_id)
    return web.json_response({'success': True})

# ============= DEAL ENDPOINTS =============

@routes.post('/api/deals/accept')
async def accept_deal(request):
    """Accept an offer and create a deal"""
    data = await request.json()
    client_id = data.get('client_id')
    exchanger_id = data.get('exchanger_id')
    rate = data.get('rate', '')
    location = data.get('location', '')
    
    from bot.database.database import create_deal, get_public_profile
    deal_id = await create_deal(client_id, exchanger_id, rate, location)
    
    # Get both users info for ticket
    client = await get_public_profile(client_id)
    exchanger = await get_public_profile(exchanger_id)
    
    # Send ticket via bot (if available)
    bot = request.app.get('bot')
    if bot and client and exchanger:
        from datetime import datetime
        ticket_text = f"""
💱 <b>NellX - СДЕЛКА ПОДТВЕРЖДЕНА</b>
━━━━━━━━━━━━━━━━━
🕐 Время: {datetime.now().strftime('%H:%M %d.%m.%Y')}
👤 Клиент: {client.get('name', 'Клиент')}
🏪 Обменник: {exchanger.get('name', 'Обменник')}
📍 Район: {location}
💰 Курс: {rate}
━━━━━━━━━━━━━━━━━
<i>NellX • Безопасный обмен</i>
"""
        # Try to send to both users
        try:
            from bot.database.database import get_account_by_id
            client_acc = await get_account_by_id(client_id)
            exchanger_acc = await get_account_by_id(exchanger_id)
            
            if client_acc and client_acc.get('telegram_id'):
                await bot.send_message(client_acc['telegram_id'], ticket_text, parse_mode="HTML")
            if exchanger_acc and exchanger_acc.get('telegram_id'):
                await bot.send_message(exchanger_acc['telegram_id'], ticket_text, parse_mode="HTML")
        except Exception as e:
            logging.error(f"Failed to send ticket: {e}")
    
    return web.json_response({'success': True, 'deal_id': deal_id})


async def init_web_app(bot):
    # Increase max size to 10MB for image uploads
    app = web.Application(middlewares=[log_requests], client_max_size=10*1024*1024)
    app['bot'] = bot
    app.add_routes(routes)
    return app

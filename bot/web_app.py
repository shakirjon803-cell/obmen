import os
import json
import logging
from aiohttp import web
from bot.database.database import (
    get_user, update_user_role, create_order, get_active_orders, 
    get_user_orders, place_bid, get_order_bids, create_market_post, get_market_posts
)

# Middleware to log all requests
@web.middleware
async def log_requests(request, handler):
    # print(f"Incoming request: {request.method} {request.path}")
    logging.info(f"Incoming request: {request.method} {request.path}")
    return await handler(request)

routes = web.RouteTableDef()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_DIST_DIR = os.path.join(BASE_DIR, 'client', 'dist')

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
    
    if not nickname or len(nickname) < 3:
        return web.json_response({'error': 'nickname_too_short'}, status=400)
    if not password or len(password) < 4:
        return web.json_response({'error': 'password_too_short'}, status=400)
    
    from bot.database.database import register_web_account
    result = await register_web_account(nickname, name or nickname, password)
    
    if 'error' in result:
        return web.json_response(result, status=400)
    
    logging.info(f"New account registered: {nickname}, code: {result['code']}")
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

@routes.post('/api/auth/verify-seller')
async def handle_verify_seller(request):
    """Verify seller code and upgrade account"""
    data = await request.json()
    code = data.get('code', '').strip()
    account_id = data.get('account_id')
    
    if not code or not account_id:
        return web.json_response({'error': 'missing_data'}, status=400)
    
    from bot.database.database import verify_seller_code
    success = await verify_seller_code(code, account_id)
    
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
    order_id = await create_order(
        int(data['user_id']), 
        float(data['amount']), 
        data['currency'], 
        data['location'], 
        data['delivery_type']
    )

    # Notify Exchangers
    try:
        from bot.database.database import get_exchangers_by_location
        from bot.locales import get_message
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
        
        # TODO: Move this to config or pass dynamically
        WEBAPP_URL = os.getenv('WEBAPP_URL', "https://b240298a9e5bd5.lhr.life") 

        exchangers = await get_exchangers_by_location(data['location'])
        bot = request.app['bot']
        
        for exchanger in exchangers:
            exchanger_id = exchanger['telegram_id']
            lang = exchanger['language'] or 'ru'
            
            if exchanger_id != int(data['user_id']): # Don't notify self
                text = get_message(lang, 'new_order', 
                    order_id=order_id,
                    amount=data['amount'],
                    currency=data['currency'],
                    location=data['location'],
                    delivery_type=data['delivery_type']
                )
                
                kb = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text=get_message(lang, 'make_offer'), callback_data=f"make_offer:{order_id}")],
                    [InlineKeyboardButton(text=get_message(lang, 'open_order'), web_app=WebAppInfo(url=WEBAPP_URL))]
                ])

                try:
                    await bot.send_message(chat_id=exchanger_id, text=text, reply_markup=kb, parse_mode="HTML")
                except Exception as e:
                    logging.warning(f"Failed to notify exchanger {exchanger_id}: {e}")

    except Exception as e:
        logging.error(f"Notification error: {e}")

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

@routes.post('/api/bids')
async def handle_place_bid(request):
    data = await request.json()
    await place_bid(
        int(data['order_id']),
        int(data['exchanger_id']),
        float(data['rate']),
        data['time_estimate'],
        data['comment']
    )
    return web.json_response({'status': 'ok'})

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

@routes.post('/api/bids/{id}/accept')
async def handle_accept_bid(request):
    bid_id = int(request.match_info['id'])
    
    from bot.database.database import accept_bid, get_user, get_order
    bid = await accept_bid(bid_id)
    
    if not bid:
        return web.json_response({'error': 'Bid not found'}, status=404)
        
    # Notify Exchanger
    try:
        exchanger_id = bid['exchanger_id']
        exchanger = await get_user(exchanger_id)
        lang = exchanger[3] if exchanger else 'ru' # language is at index 3
        
        # Get order details to get client info
        order = await get_order(bid['order_id'])
        client_name = order.get('username') or 'Unknown'
        client_phone = order.get('phone') or 'Unknown'
        
        from bot.locales import get_message
        text = get_message(lang, 'bid_accepted', 
            order_id=bid['order_id'],
            name=client_name,
            phone=client_phone
        )
        
        bot = request.app['bot']
        await bot.send_message(chat_id=exchanger_id, text=text, parse_mode="HTML")
        
    except Exception as e:
        logging.error(f"Failed to notify exchanger about accepted bid: {e}")

    return web.json_response({'status': 'ok', 'order_id': bid['order_id']})

@routes.get('/api/market')
async def handle_get_market(request):
    posts = await get_market_posts()
    return web.json_response(posts)

@routes.post('/api/market')
async def handle_create_post(request):
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

@routes.get('/api/market/my')
async def handle_get_my_posts(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({'error': 'Missing user_id'}, status=400)
    
    from bot.database.database import get_user_market_posts
    posts = await get_user_market_posts(int(user_id))
    return web.json_response(posts)

@routes.put('/api/market/{id}')
async def handle_update_post(request):
    post_id = int(request.match_info['id'])
    data = await request.json()
    user_id = data.get('user_id')
    
    from bot.database.database import update_market_post
    await update_market_post(
        post_id, 
        int(user_id), 
        float(data['amount']), 
        float(data['rate']), 
        data['description'],
        p_type=data.get('type'),
        currency=data.get('currency'),
        location=data.get('location'),
        category=data.get('category'),
        image_data=data.get('image_data')
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
    app = web.Application(middlewares=[log_requests])
    app['bot'] = bot
    app.add_routes(routes)
    return app

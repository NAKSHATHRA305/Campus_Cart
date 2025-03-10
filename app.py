from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_pymongo import PyMongo, ASCENDING
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

# Ensure the template directory exists
os.makedirs('templates', exist_ok=True)
os.makedirs('static/images', exist_ok=True)

# Load environment variables before any other configuration
load_dotenv()

# Essential configurations
app.secret_key = os.environ.get('SECRET_KEY')
if not app.secret_key:
    logger.error("No SECRET_KEY set in environment variables")
    sys.exit(1)

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Get MongoDB URI from environment variables
mongodb_uri = os.getenv('MONGODB_URI')
if not mongodb_uri:
    logger.error("No MONGODB_URI environment variable found")
    sys.exit(1)

# Configure MongoDB
app.config["MONGO_URI"] = mongodb_uri

# Initialize MongoDB connection with error handling
try:
    mongo = PyMongo(app)
    # Test the connection
    mongo.db.command('ping')
    logger.info("Successfully connected to MongoDB Atlas!")
    
    # Initialize MongoDB collections
    db = mongo.db
    
    # Create indexes for better query performance
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.products.create_index([("category", ASCENDING)])
    db.carts.create_index([("user_id", ASCENDING)])
    db.wishlists.create_index([("user_id", ASCENDING)])
    db.orders.create_index([("user_id", ASCENDING)])
    
except Exception as e:
    logger.error(f"Error connecting to MongoDB Atlas: {str(e)}")
    sys.exit(1)

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Route for home page
@app.route('/')
def index():
    electronics = list(db.products.find({"category": "electronics"}))
    bags = list(db.products.find({"category": "bags"}))
    stationery = list(db.products.find({"category": "stationery"}))
    return render_template('index.html', electronics=electronics, bags=bags, stationery=stationery)

# Authentication routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = db.users.find_one({"email": email})
        if user and check_password_hash(user['password'], password):
            # Set session variables
            session.permanent = True  # Make session permanent
            session['user_id'] = str(user['_id'])
            session['email'] = user['email']
            logger.info(f"User logged in successfully: {email}")
            return redirect(url_for('index'))
        logger.warning(f"Failed login attempt for email: {email}")
        return render_template('login.html', error="Invalid email or password")
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if db.users.find_one({"email": email}):
            return "Email already exists", 400
        
        hashed_password = generate_password_hash(password)
        user = {
            "email": email,
            "password": hashed_password,
            "created_at": datetime.utcnow()
        }
        db.users.insert_one(user)
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

# Cart routes
@app.route('/cart')
def cart():
    # Create a cart ID in session if it doesn't exist
    if 'cart_id' not in session:
        session['cart_id'] = str(ObjectId())
    
    cart = db.carts.find_one({"cart_id": session['cart_id']})
    if not cart:
        return render_template('cart.html', items=[])
    
    cart_items = []
    for item in cart.get('items', []):
        product = db.products.find_one({"_id": item['product_id']})
        if product:
            cart_items.append({
                "id": str(product['_id']),
                "name": product['name'],
                "price": product['price'],
                "image_url": product['image_url'],
                "quantity": item['quantity']
            })
    
    return render_template('cart.html', items=cart_items)

@app.route('/add-to-cart', methods=['POST'])
def add_to_cart():
    try:
        # Create a cart ID in session if it doesn't exist
        if 'cart_id' not in session:
            session['cart_id'] = str(ObjectId())
        
        product_id = ObjectId(request.json.get('product_id'))
        
        # Check if product exists
        product = db.products.find_one({"_id": product_id})
        if not product:
            logger.error(f"Product not found: {product_id}")
            return jsonify({"error": "Product not found"}), 404
        
        # Update or create cart
        result = db.carts.find_one_and_update(
            {
                "cart_id": session['cart_id'],
                "items.product_id": product_id
            },
            {"$inc": {"items.$.quantity": 1}},
            return_document=True
        )
        
        if not result:
            db.carts.find_one_and_update(
                {"cart_id": session['cart_id']},
                {
                    "$push": {
                        "items": {
                            "product_id": product_id,
                            "quantity": 1,
                            "added_date": datetime.utcnow()
                        }
                    }
                },
                upsert=True
            )
        
        logger.info(f"Item added to cart successfully: {product_id}")
        return jsonify({"message": "Added to cart", "success": True})
        
    except Exception as e:
        logger.error(f"Error adding item to cart: {str(e)}")
        return jsonify({"error": "Error adding item to cart"}), 500

@app.route('/update-cart', methods=['POST'])
def update_cart():
    try:
        if 'cart_id' not in session:
            return jsonify({"error": "Cart not found"}), 404
        
        product_id = ObjectId(request.json.get('product_id'))
        quantity = int(request.json.get('quantity'))
        
        if quantity <= 0:
            db.carts.update_one(
                {"cart_id": session['cart_id']},
                {"$pull": {"items": {"product_id": product_id}}}
            )
        else:
            db.carts.update_one(
                {
                    "cart_id": session['cart_id'],
                    "items.product_id": product_id
                },
                {"$set": {"items.$.quantity": quantity}}
            )
        
        return jsonify({"message": "Cart updated", "success": True})
        
    except Exception as e:
        logger.error(f"Error updating cart: {str(e)}")
        return jsonify({"error": "Error updating cart"}), 500

# Wishlist routes
@app.route('/wishlist')
def wishlist():
    # Create a wishlist ID in session if it doesn't exist
    if 'wishlist_id' not in session:
        session['wishlist_id'] = str(ObjectId())
    
    wishlist = db.wishlists.find_one({"wishlist_id": session['wishlist_id']})
    if not wishlist:
        return render_template('wishlist.html', items=[])
    
    wishlist_items = []
    for item in wishlist.get('products', []):
        product = db.products.find_one({"_id": item['product_id']})
        if product:
            wishlist_items.append({
                "id": str(product['_id']),
                "name": product['name'],
                "price": product['price'],
                "image_url": product['image_url']
            })
    
    return render_template('wishlist.html', items=wishlist_items)

@app.route('/add-to-wishlist', methods=['POST'])
def add_to_wishlist():
    try:
        # Create a wishlist ID in session if it doesn't exist
        if 'wishlist_id' not in session:
            session['wishlist_id'] = str(ObjectId())
        
        product_id = ObjectId(request.json.get('product_id'))
        
        # Check if product exists
        product = db.products.find_one({"_id": product_id})
        if not product:
            logger.error(f"Product not found: {product_id}")
            return jsonify({"error": "Product not found"}), 404
        
        # Add to wishlist if not already present
        result = db.wishlists.update_one(
            {"wishlist_id": session['wishlist_id']},
            {
                "$addToSet": {
                    "products": {
                        "product_id": product_id,
                        "added_date": datetime.utcnow()
                    }
                }
            },
            upsert=True
        )
        
        logger.info(f"Item added to wishlist successfully: {product_id}")
        return jsonify({"message": "Added to wishlist", "success": True})
        
    except Exception as e:
        logger.error(f"Error adding item to wishlist: {str(e)}")
        return jsonify({"error": "Error adding item to wishlist"}), 500

# Address routes
@app.route('/address')
def address():
    try:
        # Create a session ID if it doesn't exist
        if 'session_id' not in session:
            session['session_id'] = str(ObjectId())
        
        # Get addresses for the current session
        addresses = list(db.addresses.find({"session_id": session['session_id']}))
        for addr in addresses:
            addr['_id'] = str(addr['_id'])
        
        return render_template('address.html', addresses=addresses)
    except Exception as e:
        logger.error(f"Error in address page: {str(e)}")
        return redirect(url_for('index'))

@app.route('/add-address', methods=['POST'])
def add_address():
    try:
        # Create a session ID if it doesn't exist
        if 'session_id' not in session:
            session['session_id'] = str(ObjectId())
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['full_name', 'phone', 'address', 'city', 'pincode']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Create address document
        address = {
            "session_id": session['session_id'],
            "full_name": data['full_name'],
            "phone": data['phone'],
            "address": data['address'],
            "city": data['city'],
            "pincode": data['pincode'],
            "created_at": datetime.utcnow()
        }
        
        # Insert address
        result = db.addresses.insert_one(address)
        
        return jsonify({
            "success": True,
            "message": "Address added successfully",
            "address_id": str(result.inserted_id)
        })
        
    except Exception as e:
        logger.error(f"Error adding address: {str(e)}")
        return jsonify({"error": "Error adding address"}), 500

@app.route('/delete-address', methods=['POST'])
def delete_address():
    try:
        data = request.get_json()
        address_id = data.get('address_id')
        
        if not address_id:
            return jsonify({"error": "No address ID provided"}), 400
        
        # Delete address
        result = db.addresses.delete_one({
            "_id": ObjectId(address_id),
            "session_id": session.get('session_id')
        })
        
        if result.deleted_count > 0:
            return jsonify({
                "success": True,
                "message": "Address deleted successfully"
            })
        else:
            return jsonify({"error": "Address not found"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting address: {str(e)}")
        return jsonify({"error": "Error deleting address"}), 500

# Order routes
@app.route('/orders')
def orders_page():
    try:
        if 'session_id' not in session:
            session['session_id'] = str(ObjectId())
            return render_template('orders.html', orders=[])
        
        # Get orders for the current session with proper sorting
        orders = list(db.orders.find(
            {"session_id": session['session_id']}
        ).sort("order_date", -1))  # Sort by date, newest first
        
        # Format orders for display
        formatted_orders = []
        for order in orders:
            # Calculate total for each item
            for item in order['items']:
                item['total'] = item['price'] * item['quantity']
            
            # Format the order
            formatted_order = {
                "order_id": str(order['_id']),
                "items": order['items'],
                "total": order['total'],
                "address": order['address'],
                "status": order.get('status', 'Processing'),  # Default status if not set
                "order_date": order['order_date'].strftime("%B %d, %Y %I:%M %p"),
                "tracking_id": order.get('tracking_id', ''),  # For future use
                "estimated_delivery": order.get('estimated_delivery', '')  # For future use
            }
            formatted_orders.append(formatted_order)
        
        return render_template('orders.html', orders=formatted_orders)
        
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}")
        return render_template('orders.html', orders=[])

@app.route('/checkout')
def checkout():
    try:
        # Check if cart exists and has items
        if 'cart_id' not in session:
            return redirect(url_for('cart'))
        
        cart = db.carts.find_one({"cart_id": session['cart_id']})
        if not cart or not cart.get('items', []):
            return redirect(url_for('cart'))
        
        # Get cart items with product details
        cart_items = []
        subtotal = 0
        
        for item in cart['items']:
            product = db.products.find_one({"_id": item['product_id']})
            if product:
                cart_item = {
                    "id": str(product['_id']),
                    "name": product['name'],
                    "price": product['price'],
                    "image_url": product['image_url'],
                    "quantity": item['quantity']
                }
                cart_items.append(cart_item)
                subtotal += product['price'] * item['quantity']
        
        # Create a session ID if it doesn't exist
        if 'session_id' not in session:
            session['session_id'] = str(ObjectId())
        
        # Get addresses for the current session
        addresses = list(db.addresses.find({"session_id": session['session_id']}))
        for addr in addresses:
            addr['_id'] = str(addr['_id'])
        
        return render_template('checkout.html', 
                             cart_items=cart_items,
                             subtotal=subtotal,
                             addresses=addresses)
    except Exception as e:
        logger.error(f"Error in checkout: {str(e)}")
        return redirect(url_for('cart'))

@app.route('/place-order', methods=['POST'])
def place_order():
    try:
        if 'cart_id' not in session:
            return jsonify({"error": "No cart found"}), 400
        
        data = request.get_json()
        address_id = data.get('address_id')
        
        if not address_id:
            return jsonify({"error": "No address selected"}), 400
        
        # Get cart items
        cart = db.carts.find_one({"cart_id": session['cart_id']})
        if not cart or not cart.get('items', []):
            return jsonify({"error": "Cart is empty"}), 400
        
        # Get address details
        address = db.addresses.find_one({
            "_id": ObjectId(address_id),
            "session_id": session.get('session_id')
        })
        if not address:
            return jsonify({"error": "Invalid address"}), 400
        
        # Calculate order total and prepare items
        order_items = []
        total = 0
        
        for item in cart['items']:
            product = db.products.find_one({"_id": item['product_id']})
            if product:
                item_total = product['price'] * item['quantity']
                order_items.append({
                    "product_id": item['product_id'],
                    "name": product['name'],
                    "price": product['price'],
                    "quantity": item['quantity'],
                    "image_url": product['image_url'],
                    "total": item_total  # Add total for each item
                })
                total += item_total
        
        # Create order with additional fields
        order = {
            "session_id": session.get('session_id'),
            "items": order_items,
            "total": total,
            "address": {
                "full_name": address['full_name'],
                "address": address['address'],
                "city": address['city'],
                "pincode": address['pincode'],
                "phone": address['phone']
            },
            "status": "Placed",
            "order_date": datetime.utcnow(),
            "payment_status": "Completed",  # For future use with actual payment integration
            "estimated_delivery": (datetime.utcnow() + timedelta(days=5)).strftime("%B %d, %Y"),  # Estimated delivery date
            "tracking_id": f"TRK{ObjectId()}"[-8:]  # Generate a shorter tracking ID
        }
        
        # Insert order
        result = db.orders.insert_one(order)
        
        if result.inserted_id:
            # Clear the cart after successful order
            db.carts.update_one(
                {"cart_id": session['cart_id']},
                {"$set": {"items": []}}
            )
            
            # Update product stock (for future implementation)
            for item in order_items:
                db.products.update_one(
                    {"_id": item['product_id']},
                    {"$inc": {"stock": -item['quantity']}}
                )
            
            return jsonify({
                "success": True,
                "message": "Order placed successfully",
                "order_id": str(result.inserted_id)
            })
        else:
            return jsonify({"error": "Failed to create order"}), 500
        
    except Exception as e:
        logger.error(f"Error placing order: {str(e)}")
        return jsonify({"error": "Error placing order"}), 500

# Initialize database with sample products
def init_db():
    try:
        # Check if products collection exists and has documents
        if db.products.count_documents({}) == 0:
            products = [
                {
                    "name": "iPad Air",
                    "description": "Latest iPad Air with M1 chip",
                    "price": 54900,
                    "category": "electronics",
                    "image_url": "images/ipad.jpg",
                    "stock": 10,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "name": "M1 Macbook Air",
                    "description": "Thin and light Macbook Air with M1 chip",
                    "price": 119900,
                    "category": "electronics",
                    "image_url": "images/M1 macbook air.jpg",
                    "stock": 5,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "name": "Backpack",
                    "description": "Waterproof laptop backpack",
                    "price": 899,
                    "category": "bags",
                    "image_url": "images/Bag_1.jpg",
                    "stock": 20,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "name": "Tote Bag",
                    "description": "Stylish tote bag",
                    "price": 1299,
                    "category": "bags",
                    "image_url": "images/Bags_2.jpg",
                    "stock": 15,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "name": "Notebooks",
                    "description": "High-quality ruled notebook",
                    "price": 999,
                    "category": "stationery",
                    "image_url": "images/notebook.jpg",
                    "stock": 50,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                },
                {
                    "name": "Gel Pen Set",
                    "description": "Set of colorful gel pens",
                    "price": 699,
                    "category": "stationery",
                    "image_url": "images/pen-set.jpg",
                    "stock": 30,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            ]
            
            # Verify all product images exist
            missing_images = []
            for product in products:
                image_path = os.path.join('static', product['image_url'])
                if not os.path.exists(image_path):
                    missing_images.append(product['image_url'])
            
            if missing_images:
                logger.warning(f"Missing product images: {', '.join(missing_images)}")
                logger.warning("Please ensure all product images are in the static/images directory")
            
            # Insert products with error handling
            try:
                result = db.products.insert_many(products)
                logger.info(f"Successfully initialized database with {len(result.inserted_ids)} products")
            except Exception as e:
                logger.error(f"Error inserting products: {str(e)}")
                raise
        else:
            logger.info("Products collection already initialized")
            
    except Exception as e:
        logger.error(f"Error in database initialization: {str(e)}")
        raise

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

if __name__ == '__main__':
    try:
        init_db()
        app.run(debug=True)
    except Exception as e:
        print("Application failed to start:")
        print(e)
        sys.exit(1)
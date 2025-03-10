// Function to format price in Indian Rupees
function formatPrice(price) {
    return `₹${price.toLocaleString('en-IN')}`;
}

// Function to display orders
function displayOrders() {
    // Get orders from localStorage
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const container = document.querySelector('.orders-container');

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center p-4">
                <p>No orders found</p>
                <a href="index.html" class="cart-btn">Continue Shopping</a>
            </div>
        `;
        return;
    }

    const ordersHTML = orders.map((order, index) => {
        const orderItems = order.items.map(item => `
            <li>${item.quantity}x ${item.name} - ₹${(item.price * item.quantity).toLocaleString('en-IN')}</li>
        `).join('');

        const totalAmount = order.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        const orderDate = new Date(order.date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <div class="d-flex justify-content-between">
                        <span>Order #${order.orderId || (1000 + index)}</span>
                        <span>Ordered on: ${orderDate}</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title">Order Items:</h5>
                            <ul class="list-unstyled">
                                ${orderItems}
                            </ul>
                        </div>
                        <div class="col-md-4">
                            <p class="mb-1"><strong>Status:</strong> ${order.status || 'Processing'}</p>
                            <p class="mb-1"><strong>Total:</strong> ₹${totalAmount.toLocaleString('en-IN')}</p>
                            <button class="cart-btn" onclick="viewOrderDetails('${order.orderId || (1000 + index)}')">View Details</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = ordersHTML;
}

// Function to view order details (you can expand this later)
function viewOrderDetails(orderId) {
    // For future implementation of order details view
    alert(`Viewing details for order #${orderId}`);
}

// Function to save order (call this when checkout is completed)
function saveOrder(cartItems) {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const newOrder = {
        orderId: generateOrderId(),
        date: new Date().toISOString(),
        items: cartItems,
        status: 'Processing'
    };
    orders.push(newOrder);
    localStorage.setItem('orders', JSON.stringify(orders));
}

function generateOrderId() {
    return 'ORD' + Date.now().toString().slice(-6);
}

// Load orders when the page loads
document.addEventListener('DOMContentLoaded', function() {
    displayOrders();
});

// Add this to your checkout form submission handler
document.getElementById('checkout-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get cart items
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    if (cart.length > 0) {
        // Save the order
        saveOrder(cart);
        
        // Clear the cart
        localStorage.removeItem('cart');
        
        // Show success message
        alert('Order placed successfully!');
        
        // Redirect to orders page
        window.location.href = 'orders.html';
    }
}); 
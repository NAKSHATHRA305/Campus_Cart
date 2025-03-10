document.addEventListener('DOMContentLoaded', function() {
    updateCartDisplay();
});

async function updateCartDisplay() {
    try {
        const response = await fetch('/get-cart');
        const cart = await response.json();
        
        const cartContainer = document.getElementById('cart-items');
        const summaryElement = document.getElementById('order-summary');
        
        if (cartContainer) {
            cartContainer.innerHTML = '';
            let subtotal = 0;

            if (cart.length === 0) {
                cartContainer.innerHTML = `
                    <div class="empty-cart">
                        <p>Your cart is empty</p>
                        <a href="/" class="btn btn-primary">Continue Shopping</a>
                    </div>
                `;
            } else {
                cart.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    subtotal += itemTotal;

                    cartContainer.innerHTML += `
                        <div class="card mb-3">
                            <div class="cart-item">
                                <img src="/static/${item.image}" alt="${item.name}" class="card-img-top" style="width: 120px; height: 120px; object-fit: cover;">
                                <div class="card-body cart-item-details">
                                    <h5 class="card-title">${item.name}</h5>
                                    <p class="price">₹${item.price}</p>
                                    <div class="quantity-controls">
                                        <button onclick="updateQuantity(${item.id}, -1)">-</button>
                                        <span>${item.quantity}</span>
                                        <button onclick="updateQuantity(${item.id}, 1)">+</button>
                                    </div>
                                    <p class="card-text">Item Total: ₹${itemTotal}</p>
                                    <button class="cart-btn remove-btn" onclick="removeItem(${item.id})">Remove</button>
                                </div>
                            </div>
                        </div>
                    `;
                });

                // Update order summary
                if (summaryElement) {
                    summaryElement.innerHTML = `
                        <h4>Order Summary</h4>
                        <div class="summary-item">
                            <span>Subtotal:</span>
                            <span>₹${subtotal}</span>
                        </div>
                        <div class="summary-item">
                            <span>Shipping:</span>
                            <span>Free</span>
                        </div>
                        <div class="summary-item total">
                            <span>Total:</span>
                            <span>₹${subtotal}</span>
                        </div>
                        <button class="checkout-btn" onclick="window.location.href='/checkout'">
                            Proceed to Checkout
                        </button>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Error updating cart:', error);
        showToast('Error updating cart');
    }
}

async function updateQuantity(productId, change) {
    try {
        const response = await fetch('/update-cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                change: change
            })
        });
        
        if (response.ok) {
            updateCartDisplay();
        } else {
            showToast('Error updating quantity');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error updating quantity');
    }
}

async function removeItem(productId) {
    try {
        const response = await fetch('/remove-from-cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId
            })
        });
        
        if (response.ok) {
            updateCartDisplay();
            showToast('Item removed from cart');
        } else {
            showToast('Error removing item');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error removing item');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
} 
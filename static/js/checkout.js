document.addEventListener('DOMContentLoaded', function() {
    loadAddresses();
    loadCartItems();
    // Add event listeners to address selection
    document.querySelectorAll('input[name="delivery-address"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.address-item').forEach(item => {
                item.classList.remove('selected');
            });
            if (this.checked) {
                this.closest('.address-item').classList.add('selected');
            }
        });
    });
});

async function loadAddresses() {
    try {
        const response = await fetch('/addresses');
        const addresses = await response.json();
        const addressList = document.getElementById('address-list');
        
        if (addresses.length === 0) {
            addressList.innerHTML = `
                <div class="alert alert-info">
                    No saved addresses found. Please add a new address to continue.
                </div>
            `;
            return;
        }

        addressList.innerHTML = addresses.map(addr => `
            <div class="address-item" data-address-id="${addr.id}">
                <div class="address-details">
                    <strong>${addr.full_name}</strong><br>
                    ${addr.address}<br>
                    ${addr.city} - ${addr.pincode}<br>
                    Phone: ${addr.phone}
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="delivery-address" value="${addr.id}">
                    <label class="form-check-label">Deliver to this address</label>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading addresses:', error);
        showToast('Error loading addresses');
    }
}

async function loadCartItems() {
    try {
        const response = await fetch('/get-cart');
        const cart = await response.json();
        const orderItems = document.getElementById('order-items');
        const orderTotal = document.getElementById('order-total');
        
        if (cart.length === 0) {
            document.querySelector('.container').innerHTML = `
                <div class="alert alert-warning text-center">
                    Your cart is empty. Please add items to proceed with checkout.
                    <br><br>
                    <a href="/" class="cart-btn">Continue Shopping</a>
                </div>
            `;
            return;
        }

        let subtotal = 0;
        orderItems.innerHTML = cart.map(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            return `
                <div class="order-item">
                    <div class="item-details">
                        <img src="/static/${item.image}" alt="${item.name}" class="item-image">
                        <div class="item-info">
                            <h4>${item.name}</h4>
                            <p>Quantity: ${item.quantity}</p>
                        </div>
                    </div>
                    <div class="item-price">₹${itemTotal}</div>
                </div>
            `;
        }).join('');

        orderTotal.innerHTML = `
            <div class="summary-total">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>₹${subtotal}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping:</span>
                    <span>Free</span>
                </div>
                <div class="summary-row final">
                    <span>Total:</span>
                    <span>₹${subtotal}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading cart:', error);
        showToast('Error loading cart items');
    }
}

async function placeOrder() {
    const selectedAddress = document.querySelector('input[name="delivery-address"]:checked');
    
    if (!selectedAddress) {
        showToast('Please select a delivery address');
        return;
    }

    try {
        const response = await fetch('/place-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address_id: parseInt(selectedAddress.value)
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Order placed successfully!');
            // Redirect to orders page after 2 seconds
            setTimeout(() => {
                window.location.href = '/orders-page';
            }, 2000);
        } else {
            showToast(data.error || 'Error placing order');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showToast('Error placing order');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
} 
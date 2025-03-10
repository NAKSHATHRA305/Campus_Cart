document.addEventListener('DOMContentLoaded', function() {
    displayWishlistItems();
});

async function displayWishlistItems() {
    try {
        const response = await fetch('/get-wishlist');
        const wishlist = await response.json();
        const container = document.getElementById('wishlist-items');
        
        if (wishlist.length === 0) {
            container.innerHTML = `
                <div class="empty-wishlist">
                    <p>Your wishlist is empty</p>
                    <a href="/" class="cart-btn">Continue Shopping</a>
                </div>
            `;
            return;
        }

        const wishlistHTML = wishlist.map(item => `
            <div class="col-md-4">
                <div class="card">
                    <img src="/static/${item.image}" class="card-img-top product-img" alt="${item.name}">
                    <div class="card-body">
                        <h5 class="card-title">${item.name}</h5>
                        <p class="card-text">${item.description}</p>
                        <p class="price">₹${item.price}</p>
                        <div class="button-group">
                            <button class="cart-btn" data-product-id="${item.id}">Add to Cart</button>
                            <button class="remove-btn" data-product-id="${item.id}">Remove</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = wishlistHTML;
        
        // Add event listeners to the new buttons
        attachEventListeners();
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        showToast('Error loading wishlist');
    }
}

function attachEventListeners() {
    // Add to Cart functionality
    document.querySelectorAll('.cart-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const productId = this.dataset.productId;
            try {
                const response = await fetch('/add-to-cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ product_id: productId })
                });
                
                if (response.ok) {
                    showToast('Item added to cart successfully');
                } else {
                    showToast('Error adding item to cart');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error adding item to cart');
            }
        });
    });

    // Remove from Wishlist functionality
    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const productId = this.dataset.productId;
            const card = this.closest('.col-md-4');
            
            try {
                const response = await fetch('/remove-from-wishlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ product_id: productId })
                });
                
                if (response.ok) {
                    card.remove();
                    showToast('Item removed from wishlist');
                    // Refresh if wishlist is empty
                    if (!document.getElementById('wishlist-items').children.length) {
                        displayWishlistItems();
                    }
                } else {
                    showToast('Error removing item from wishlist');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error removing item from wishlist');
            }
        });
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
} 
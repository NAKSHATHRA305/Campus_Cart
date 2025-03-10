// Function to show toast notifications
function showToast(message, isSuccess = true) {
    if (typeof Toastify === 'undefined') {
        alert(message);
        return;
    }
    
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: isSuccess ? "#2c3e50" : "#e74c3c",
        stopOnFocus: true,
        style: {
            fontSize: '16px',
            padding: '12px 20px',
            borderRadius: '4px'
        }
    }).showToast();
}

// Function to handle wishlist actions
async function handleWishlistAction(button) {
    const productId = button.getAttribute('data-product-id');
    const heartIcon = button.querySelector('img');
    const isRemoving = heartIcon.src.includes('heart-filled.png');
    
    try {
        const response = await fetch('/add-to-wishlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                product_id: productId,
                remove: isRemoving
            })
        });
        
        const data = await response.json();
        if (data.success) {
            if (isRemoving) {
                if (window.location.pathname === '/wishlist') {
                    const productCard = button.closest('.product-card');
                    if (productCard) {
                        productCard.remove();
                        showToast('Removed from wishlist successfully!');
                        
                        // Check if wishlist is empty
                        const remainingCards = document.querySelectorAll('.product-card');
                        if (remainingCards.length === 0) {
                            const container = document.querySelector('.container');
                            if (container) {
                                container.innerHTML = `
                                    <h2 class="section-title">My Wishlist</h2>
                                    <div class="empty-wishlist">
                                        <h3>Your wishlist is empty</h3>
                                        <p>Add items to your wishlist to see them here.</p>
                                        <a href="/" class="btn btn-primary">Continue Shopping</a>
                                    </div>
                                `;
                            }
                        }
                    }
                } else {
                    heartIcon.src = '/static/images/heart.png';
                    showToast('Removed from wishlist successfully!');
                }
            } else {
                heartIcon.src = '/static/images/heart-filled.png';
                showToast('Added to wishlist successfully!');
            }
        } else {
            showToast(data.error || 'Error updating wishlist', false);
        }
    } catch (error) {
        showToast('Error updating wishlist', false);
        console.error('Error:', error);
    }
}

// Add to Cart functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add to Cart
    const addToCartButtons = document.querySelectorAll('.cart-btn');
    addToCartButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.disabled) return;
            this.disabled = true;
            
            const productId = this.getAttribute('data-product-id');
            
            try {
                const response = await fetch('/add-to-cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ product_id: productId })
                });
                
                const data = await response.json();
                if (data.success) {
                    showToast('Added to cart successfully!');
                } else {
                    showToast(data.error || 'Error adding to cart', false);
                }
            } catch (error) {
                showToast('Error adding to cart', false);
                console.error('Error:', error);
            } finally {
                this.disabled = false;
            }
        });
    });

    // Add to Wishlist
    document.addEventListener('click', function(e) {
        const wishlistButton = e.target.closest('.wishlist-btn');
        if (wishlistButton && !wishlistButton.dataset.processing) {
            e.preventDefault();
            e.stopPropagation();
            
            wishlistButton.dataset.processing = 'true';
            handleWishlistAction(wishlistButton).finally(() => {
                delete wishlistButton.dataset.processing;
            });
        }
    });

    // Cart quantity controls
    const quantityButtons = document.querySelectorAll('.quantity-btn');
    quantityButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const productId = this.getAttribute('data-product-id');
            const action = this.getAttribute('data-action');
            const quantitySpan = this.parentElement.querySelector('.quantity');
            let currentQuantity = parseInt(quantitySpan.textContent);
            
            if (action === 'increase') {
                currentQuantity++;
            } else if (action === 'decrease' && currentQuantity > 1) {
                currentQuantity--;
            } else if (action === 'decrease' && currentQuantity === 1) {
                // Remove item if quantity would be 0
                if (confirm('Remove this item from cart?')) {
                    currentQuantity = 0;
                } else {
                    return;
                }
            }

            try {
                const response = await fetch('/update-cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        product_id: productId,
                        quantity: currentQuantity
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    if (currentQuantity === 0) {
                        // Remove the item from DOM
                        const cartItem = button.closest('.cart-item');
                        cartItem.remove();
                        showToast('Item removed from cart');
                        // If no more items, show empty cart message
                        if (document.querySelectorAll('.cart-item').length === 0) {
                            location.reload();
                        }
                    } else {
                        quantitySpan.textContent = currentQuantity;
                        showToast('Cart updated successfully!');
                        // Update the item total and cart total
                        updateCartTotals();
                    }
                } else {
                    showToast(data.error || 'Error updating cart', false);
                }
            } catch (error) {
                showToast('Error updating cart', false);
                console.error('Error:', error);
            }
        });
    });

    // Remove from cart
    const removeButtons = document.querySelectorAll('.remove-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const productId = this.getAttribute('data-product-id');
            
            if (confirm('Are you sure you want to remove this item?')) {
                try {
                    const response = await fetch('/update-cart', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            product_id: productId,
                            quantity: 0
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        const cartItem = button.closest('.cart-item');
                        cartItem.remove();
                        showToast('Item removed from cart');
                        // If no more items, show empty cart message
                        if (document.querySelectorAll('.cart-item').length === 0) {
                            location.reload();
                        } else {
                            // Update cart totals
                            updateCartTotals();
                        }
                    } else {
                        showToast(data.error || 'Error removing item', false);
                    }
                } catch (error) {
                    showToast('Error removing item', false);
                    console.error('Error:', error);
                }
            }
        });
    });
});

// Function to update cart totals
function updateCartTotals() {
    let subtotal = 0;
    document.querySelectorAll('.cart-item').forEach(item => {
        const price = parseFloat(item.querySelector('.price').textContent.replace('₹', ''));
        const quantity = parseInt(item.querySelector('.quantity').textContent);
        const itemTotal = price * quantity;
        item.querySelector('p:last-of-type').textContent = `Item Total: ₹${itemTotal}`;
        subtotal += itemTotal;
    });
    
    const summaryItems = document.querySelectorAll('.summary-item');
    if (summaryItems.length >= 3) {
        summaryItems[0].querySelector('span:last-child').textContent = `₹${subtotal}`;
        summaryItems[2].querySelector('span:last-child').textContent = `₹${subtotal}`;
    }
}

// Function to format price in Indian Rupee format
function formatPrice(price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Function to handle checkout process
function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty! Please add items before checking out.');
        return;
    }
    // Save cart data and redirect to checkout page
    localStorage.setItem('cart', JSON.stringify(cart));
    window.location.href = 'checkout.html';
}  
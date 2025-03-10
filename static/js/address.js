document.addEventListener('DOMContentLoaded', function() {
    displayAddresses();
    
    // Handle form submission
    document.getElementById('addressForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAddress();
    });
});

function displayAddresses() {
    const addresses = JSON.parse(localStorage.getItem('addresses')) || [];
    const container = document.getElementById('address-list');
    
    if (addresses.length === 0) {
        container.innerHTML = `
            <div class="text-center p-4">
                <p>No addresses saved yet</p>
            </div>
        `;
        return;
    }

    const addressesHTML = addresses.map((address, index) => `
        <div class="address-card" data-id="${index}">
            <div class="address-info">
                <div class="address-name">${address.fullName}</div>
                <div>${address.address}</div>
                <div>${address.city} - ${address.pincode}</div>
                <div>Phone: ${address.phone}</div>
            </div>
            <div class="address-actions">
                <button class="edit-btn" onclick="editAddress(${index})">
                    <img src="edit.png" alt="Edit" width="24" height="24">
                </button>
                <button class="delete-btn" onclick="deleteAddress(${index})">
                    <img src="delete.png" alt="Delete" width="24" height="24">
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = addressesHTML;
}

function showAddAddressForm() {
    document.getElementById('modalTitle').textContent = 'Add New Address';
    document.getElementById('addressForm').reset();
    document.getElementById('addressId').value = '';
    new bootstrap.Modal(document.getElementById('addressModal')).show();
}

function editAddress(index) {
    const addresses = JSON.parse(localStorage.getItem('addresses')) || [];
    const address = addresses[index];
    
    document.getElementById('modalTitle').textContent = 'Edit Address';
    document.getElementById('addressId').value = index;
    document.getElementById('fullName').value = address.fullName;
    document.getElementById('phone').value = address.phone;
    document.getElementById('address').value = address.address;
    document.getElementById('city').value = address.city;
    document.getElementById('pincode').value = address.pincode;
    
    new bootstrap.Modal(document.getElementById('addressModal')).show();
}

function saveAddress() {
    const addressId = document.getElementById('addressId').value;
    const addressData = {
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        pincode: document.getElementById('pincode').value
    };

    let addresses = JSON.parse(localStorage.getItem('addresses')) || [];
    
    if (addressId === '') {
        // Add new address
        addresses.push(addressData);
        showToast('Address added successfully');
    } else {
        // Update existing address
        addresses[parseInt(addressId)] = addressData;
        showToast('Address updated successfully');
    }

    localStorage.setItem('addresses', JSON.stringify(addresses));
    bootstrap.Modal.getInstance(document.getElementById('addressModal')).hide();
    displayAddresses();
}

function deleteAddress(index) {
    if (confirm('Are you sure you want to delete this address?')) {
        let addresses = JSON.parse(localStorage.getItem('addresses')) || [];
        addresses.splice(index, 1);
        localStorage.setItem('addresses', JSON.stringify(addresses));
        displayAddresses();
        showToast('Address deleted successfully');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
} 
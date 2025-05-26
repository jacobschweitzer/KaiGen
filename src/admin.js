/**
 * Admin-specific JavaScript for Kaigen plugin
 */

document.addEventListener('DOMContentLoaded', function() {
    // Handle remove key functionality
    const removeButtons = document.querySelectorAll('.kaigen-remove-key');
    
    removeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const providerId = this.getAttribute('data-provider');
            const inputField = document.getElementById('kaigen_' + providerId + '_api_key');
            if (inputField) {
                inputField.value = '';
            }
        });
    });
});

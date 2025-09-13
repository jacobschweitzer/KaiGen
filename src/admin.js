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
            // Check for warnings after removing key
            checkProviderWarning();
        });
    });

    // Handle provider selection changes
    const providerSelect = document.querySelector('select[name="kaigen_provider"]');
    if (providerSelect) {
        // Initialize on page load
        handleProviderChange();
        
        // Handle changes
        providerSelect.addEventListener('change', handleProviderChange);
    }

    // Add event listeners to API key inputs to check warnings when typing
    const apiKeyInputs = document.querySelectorAll('input[id*="kaigen_"][id*="_api_key"]');
    apiKeyInputs.forEach(function(input) {
        input.addEventListener('input', function() {
            // Small delay to allow for typing
            setTimeout(checkProviderWarning, 300);
        });
    });

    function handleProviderChange() {
        const selectedProvider = providerSelect.value;
        
        // Hide all API key field rows first
        const allApiKeyInputs = document.querySelectorAll('input[id*="kaigen_"][id*="_api_key"]');
        allApiKeyInputs.forEach(function(input) {
            const row = input.closest('tr');
            if (row) {
                row.classList.add('kaigen-hidden');
            }
        });

        // Show the selected provider's API key field row
        if (selectedProvider) {
            const selectedApiKeyInput = document.getElementById('kaigen_' + selectedProvider + '_api_key');
            if (selectedApiKeyInput) {
                const row = selectedApiKeyInput.closest('tr');
                if (row) {
                    row.classList.remove('kaigen-hidden');
                }
            }
        }

        // Check for warnings
        checkProviderWarning();
    }

    function checkProviderWarning() {
        const selectedProvider = providerSelect ? providerSelect.value : '';
        
        // Remove existing warning
        const existingWarning = document.getElementById('kaigen-provider-warning-row');
        if (existingWarning) {
            existingWarning.remove();
        }

        if (selectedProvider) {
            const apiKeyInput = document.getElementById('kaigen_' + selectedProvider + '_api_key');
            if (apiKeyInput && !apiKeyInput.value.trim()) {
                // Create warning message
                const warning = document.createElement('div');
                warning.className = 'notice notice-warning inline kaigen-warning';
                warning.innerHTML = '<p><strong>Warning:</strong> You have selected ' + getProviderName(selectedProvider) + ' but no API key is set. Please enter your API key below.</p>';
                
                // Insert warning after the provider select field row
                const providerRow = providerSelect.closest('tr');
                if (providerRow) {
                    const warningRow = document.createElement('tr');
                    warningRow.id = 'kaigen-provider-warning-row';
                    const warningCell = document.createElement('td');
                    warningCell.colSpan = 2;
                    warningCell.appendChild(warning);
                    warningRow.appendChild(warningCell);
                    
                    providerRow.parentNode.insertBefore(warningRow, providerRow.nextSibling);
                }
            }
        }
    }

    function getProviderName(providerId) {
        const option = providerSelect.querySelector('option[value="' + providerId + '"]');
        return option ? option.textContent : providerId;
    }

    // Check for warnings on initial load
    if (providerSelect) {
        checkProviderWarning();
    }
});

/**
 * WordPress E2E test suite using Playwright.
 * Tests basic functionality of the image block and AI image generation.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/**
 * Helper function to configure KaiGen provider settings via WordPress admin.
 */
async function configureKaiGenProvider(page: any) {
    // Navigate to the KaiGen settings page
    await page.goto('/wp-admin/options-general.php?page=kaigen-settings');
    
    // Wait for the settings page to load
    await page.waitForSelector('.wrap h1', { timeout: 10000 });
    
    // Verify we're on the correct page
    const pageTitle = await page.locator('.wrap h1').textContent();
    
    if (pageTitle !== 'KaiGen Settings') {
        throw new Error(`Expected "KaiGen Settings" but got "${pageTitle}"`);
    }
    
    // Set the API key
    const apiKeyField = page.locator('input[name="kaigen_provider_api_keys[openai]"]');
    if (await apiKeyField.count() > 0) {
        await apiKeyField.fill('test-api-key-for-testing-purposes');
    }
    
    // Set quality settings
    const qualitySelect = page.locator('select[name="kaigen_quality_settings[quality]"]');
    if (await qualitySelect.count() > 0) {
        await qualitySelect.selectOption('medium');
    }
    
    // Save settings to activate provider
    const saveButton = page.locator('input[type="submit"][value="Save Changes"], button[type="submit"]');
    if (await saveButton.count() > 0) {
        await saveButton.click();
        
        try {
            await page.waitForSelector('.notice-success, .updated', { timeout: 5000 });
        } catch (error) {
            // Continue even if no notice appears
        }
        
        await page.waitForTimeout(1000);
    }
    
    // Now select the provider
    const providerSelect = page.locator('select[name="kaigen_provider"]');
    if (await providerSelect.count() > 0) {
        const options = await providerSelect.locator('option').allTextContents();
        
        const hasOpenAI = options.some(option => option.toLowerCase().includes('openai'));
        
        if (hasOpenAI) {
            await providerSelect.selectOption('openai');
            
            // Save provider selection
            if (await saveButton.count() > 0) {
                await saveButton.click();
                
                try {
                    await page.waitForSelector('.notice-success, .updated', { timeout: 5000 });
                } catch (error) {
                    // Continue even if no notice appears
                }
            }
        }
    }
}

/**
 * Test suite for WordPress Image Block functionality.
 */
test.describe('Image Block', () => {
    /**
     * One-time setup for the entire test suite.
     */
    test.beforeAll(async ({ browser }) => {
        // Create a new page for configuration
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Navigate to admin and configure provider
        await page.goto('/wp-admin/');
        await page.waitForLoadState('networkidle');
        
        // Configure the provider once for all tests
        await configureKaiGenProvider(page);
        
        // Take a screenshot of the final configuration
        await page.screenshot({ 
            path: 'tests/test-results/provider-configured-final.png',
            fullPage: true 
        });
        
        await context.close();
    });

    /**
     * Setup function that runs before each test.
     */
    test.beforeEach(async ({ admin, page }) => {
        test.setTimeout(60000); // Reduced timeout since no provider config needed
        
        // Just create a new post - provider is already configured
        await admin.createNewPost();
    });

    /**
     * Test case for verifying basic WordPress and plugin setup.
     */
    test('should have WordPress and plugin loaded correctly', async ({ page }) => {
        // Navigate to admin dashboard
        await page.goto('/wp-admin/');
        await page.waitForLoadState('networkidle');
        
        // Verify WordPress is loaded
        const wpTitle = await page.title();
        expect(wpTitle).toContain('Dashboard');
        
        // Check if KaiGen plugin is active
        await page.goto('/wp-admin/options-general.php?page=kaigen-settings');
        await page.waitForSelector('.wrap h1', { timeout: 10000 });
        
        const settingsTitle = await page.locator('.wrap h1').textContent();
        expect(settingsTitle).toBe('KaiGen Settings');
        
        // Verify provider is configured
        const providerSelect = page.locator('select[name="kaigen_provider"]');
        const selectedProvider = await providerSelect.inputValue();
        expect(selectedProvider).toBe('openai');
    });

    /**
     * Test case for verifying image block insertion.
     */
    test('should insert image block with placeholder', async ({ editor, page }) => {
        // Insert the image block
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        
        // Wait for the block to be visible
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Verify the block has the correct structure
        const mediaPlaceholder = imageBlock.locator('.components-placeholder');
        await expect(mediaPlaceholder).toBeVisible();
        
        // Check for upload button
        const uploadButton = imageBlock.getByRole('button', { name: /upload/i });
        await expect(uploadButton).toBeVisible();
    });

    /**
     * Test case for verifying AI image generation button.
     */
    test('should show KaiGen button in media placeholder', async ({ editor, page }) => {
        // Insert a new image block
        await editor.insertBlock({ name: 'core/image' });
        
        // Wait for the image block to be visible
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Wait for scripts to load
        await page.waitForTimeout(2000);
        
        // Look for the "KaiGen" button
        const aiGenerateButton = editor.canvas.getByRole('button', { 
            name: 'KaiGen',
            exact: true 
        });
        
        // Verify the button exists and is visible
        await expect(aiGenerateButton).toBeVisible({ timeout: 10000 });
        await expect(aiGenerateButton).toBeEnabled();
    });

    /**
     * Test case for verifying KaiGen button interaction.
     */
    test('should handle KaiGen button click', async ({ editor, page }) => {
        // Insert image block
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Wait for any initial loading to complete
        await page.waitForTimeout(2000);
        
        // Check if there's already a modal open and close it
        const existingModal = page.locator('.components-modal__screen-overlay');
        if (await existingModal.count() > 0) {
            // Try to close via close button
            const closeButton = page.locator('.components-modal__header button[aria-label*="Close" i], .components-modal__header button[aria-label*="close" i]');
            if (await closeButton.count() > 0) {
                await closeButton.click();
            } else {
                // Fallback: press Escape key
                await page.keyboard.press('Escape');
            }
            
            // Wait for modal to close
            await expect(existingModal).not.toBeVisible({ timeout: 5000 });
        }
        
        // Find the KaiGen button
        const aiGenerateButton = editor.canvas.getByRole('button', { 
            name: 'KaiGen',
            exact: true 
        });
        await expect(aiGenerateButton).toBeVisible({ timeout: 10000 });
        
        // Take a screenshot before clicking
        await page.screenshot({ 
            path: 'tests/test-results/before-kaigen-click.png',
            fullPage: true 
        });
        
        // Click the KaiGen button using force option to bypass any overlay issues
        await aiGenerateButton.click({ force: true });
        
        // Wait for the modal to appear
        const modal = page.locator('.components-modal__screen-overlay');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Take a screenshot of the modal
        await page.screenshot({ 
            path: 'tests/test-results/kaigen-modal-opened.png',
            fullPage: true 
        });
        
        // Check for modal content
        const modalContent = page.locator('.components-modal__content');
        await expect(modalContent).toBeVisible({ timeout: 5000 });
        
        // Look for the modal title
        const modalTitle = page.locator('.components-modal__header h1, .components-modal__header-heading');
        await expect(modalTitle).toBeVisible({ timeout: 5000 });
        
        const titleText = await modalTitle.textContent();
        expect(titleText).toBe('KaiGen');
        
        // Look for prompt input field
        const promptInput = page.locator('textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea');
        await expect(promptInput).toBeVisible({ timeout: 5000 });
        
        // Test entering a prompt
        await promptInput.fill('A beautiful sunset over mountains');
        
        // Look for generate button (the button text is "KaiGen" according to the component)
        const generateButton = page.locator('button:has-text("KaiGen"):not(:has-text("generating"))');
        await expect(generateButton).toBeVisible({ timeout: 5000 });
        
        // Close the modal by clicking the close button or pressing Escape
        const closeButton = page.locator('.components-modal__header button[aria-label*="Close" i], .components-modal__header button[aria-label*="close" i]');
        if (await closeButton.count() > 0) {
            await closeButton.click();
        } else {
            // Fallback: press Escape key
            await page.keyboard.press('Escape');
        }
        
        // Wait for modal to disappear
        await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    /**
     * Test case for verifying provider data is available in editor.
     */
    test('should have provider data available in editor', async ({ editor, page }) => {
        // Insert image block to trigger editor scripts
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Wait for scripts to load
        await page.waitForTimeout(2000);
        
        // Check if kaiGen object is available
        const kaiGenData = await page.evaluate(() => {
            return (window as any).kaiGen || null;
        });
        
        // Verify that kaiGen data exists and has provider
        expect(kaiGenData).toBeTruthy();
        expect(kaiGenData).toHaveProperty('provider');
        expect(kaiGenData.provider).toBe('openai');
    });
});
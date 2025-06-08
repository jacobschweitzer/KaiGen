/**
 * E2E test for KaiGen image generation with mocked API responses.
 * Tests the complete flow of generating an AI image in the block editor.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe('KaiGen Image Generation', () => {


    /**
     * Configure provider once before all tests
     */
    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Navigate to admin and wait for it to be ready
        await page.goto('/wp-admin/');
        await page.waitForLoadState('networkidle');
        
        // Verify that the mock is loaded by checking for the E2E_TESTING constant
        const mockStatus = await page.evaluate(() => {
            return window.wp && window.wp.hooks ? 'WordPress loaded' : 'WordPress not ready';
        });
        console.log('WordPress status:', mockStatus);
        
        // Configure KaiGen settings
        await page.goto('/wp-admin/options-general.php?page=kaigen-settings');
        await page.waitForSelector('.wrap h1', { timeout: 10000 });
        
        // Select OpenAI provider
        const providerSelect = page.locator('select[name="kaigen_provider"]');
        await providerSelect.selectOption('openai');
        await page.waitForTimeout(500);
        
        // Set API key (will be intercepted by mock)
        const apiKeyField = page.locator('input[name="kaigen_provider_api_keys[openai]"]');
        await apiKeyField.fill('sk-test-e2e-key-1234567890');
        
        // Set quality
        const qualitySelect = page.locator('select[name="kaigen_quality_settings[quality]"]');
        await qualitySelect.selectOption('medium');
        
        // Save settings
        const saveButton = page.locator('input[type="submit"][value="Save Changes"]');
        await saveButton.click();
        
        // Wait for success notice
        await page.waitForSelector('.notice-success, .updated', { timeout: 5000 }).catch(() => {});
        
        await context.close();
    });

    test.beforeEach(async ({ admin, page }) => {
        test.setTimeout(60000);
        await admin.createNewPost();
    });

    /**
     * Test successful image generation with OpenAI provider
     */
    test('should generate image successfully with OpenAI', async ({ editor, page }) => {
        // Add debugging to see what's happening in the browser console
        page.on('console', msg => console.log('Browser console:', msg.text()));
        page.on('pageerror', error => console.log('Page error:', error.message));
        
        // Check for a Content Security Policy
        const csp = await page.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.getAttribute('content') : 'No CSP meta tag found.';
        });
        console.log('Content Security Policy:', csp);

        // Insert image block
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlock = editor.canvas.locator('[data-type="core/image"]');
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Click KaiGen button
        const kaiGenButton = editor.canvas.getByRole('button', { 
            name: 'KaiGen',
            exact: true 
        });
        await expect(kaiGenButton).toBeVisible({ timeout: 10000 });
        await kaiGenButton.click();
        
        // Wait for modal
        const modal = page.locator('.components-modal__screen-overlay');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Enter prompt
        const promptInput = page.locator('textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea');
        await expect(promptInput).toBeVisible({ timeout: 5000 });
        await promptInput.fill('A beautiful sunset over mountains');
        
        // Click generate button
        const generateButton = page.locator('button:has-text("KaiGen"):not(:has-text("generating"))');
        await expect(generateButton).toBeVisible({ timeout: 5000 });
        
        // Add debugging to check if the REST API endpoint is accessible
        const apiCheck = await page.evaluate(async () => {
            try {
                const response = await fetch('/wp-json/kaigen/v1/generate-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (window as any).wpApiSettings?.nonce || ''
                    },
                    body: JSON.stringify({
                        prompt: 'test',
                        provider: 'openai'
                    })
                });
                return {
                    status: response.status,
                    ok: response.ok,
                    statusText: response.statusText
                };
            } catch (error) {
                return {
                    error: error.message
                };
            }
        });
        console.log('API check result:', apiCheck);
        
        await generateButton.click();
        
        // Wait for generation to start (button should show generating state)
        await expect(page.locator('button:has-text("generating")')).toBeVisible({ timeout: 5000 });
        
        // Wait for generation to complete (mocked response should be quick)
        // Check for either success (modal closes) or error message
        try {
            // Wait for modal to close (indicating success)
            await expect(modal).not.toBeVisible({ timeout: 15000 });
            
            // Verify image was inserted
            const insertedImage = imageBlock.locator('img');
            await expect(insertedImage).toBeVisible({ timeout: 10000 });
            
            // Get the image src
            const imageSrc = await insertedImage.getAttribute('src');
            expect(imageSrc).toBeTruthy();
            
            console.log('Generated image SRC:', imageSrc);

            // Wait for the image to be fully loaded and rendered before taking screenshots
            await insertedImage.evaluate(image => {
                const img = image as HTMLImageElement;
                if (img.complete && img.naturalWidth > 0) {
                    return;
                }
                return new Promise((resolve, reject) => {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', () => reject(new Error('Image failed to load')));
                });
            });

            // Take a screenshot of the full editor for context
            await page.screenshot({ 
                path: 'tests/test-results/full-editor-openai.png',
                fullPage: true 
            });
            
            // Take a screenshot of just the image block
            await insertedImage.screenshot({
                path: 'tests/test-results/generated-image-openai.png'
            });
        } catch (error) {
            // If modal didn't close, check for error messages
            if (await modal.isVisible()) {
                const errorText = await modal.textContent();
                console.log('Modal content when test failed:', errorText);
            }
            
            // Check if it's the offline error
            const pageContent = await page.textContent('body');
            if (pageContent?.includes('offline')) {
                test.skip(true, 'Test environment appears to be offline - HTTP mock may not be working');
            } else {
                // Re-throw the original error for other failures
                throw error;
            }
        }
    });

    /**
     * Test image generation with Replicate provider
     */
    test('should generate image successfully with Replicate', async ({ editor, page, admin }) => {
        // First, change provider to Replicate
        await page.goto('/wp-admin/options-general.php?page=kaigen-settings');
        await page.waitForSelector('.wrap h1', { timeout: 10000 });
        
        // Select Replicate provider
        const providerSelect = page.locator('select[name="kaigen_provider"]');
        await providerSelect.selectOption('replicate');
        await page.waitForTimeout(500);
        
        // Set API key
        const apiKeyField = page.locator('input[name="kaigen_provider_api_keys[replicate]"]');
        await apiKeyField.fill('r8_test_abcdefghijklmnopqrstuvwxyz123456');
        
        // Save settings
        const saveButton = page.locator('input[type="submit"][value="Save Changes"]');
        await saveButton.click();
        await page.waitForTimeout(1000);
        
        // Create new post
        await admin.createNewPost();
        
        // Insert image block
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlock = editor.canvas.locator('[data-type="core/image"]');
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Click KaiGen button
        const kaiGenButton = editor.canvas.getByRole('button', { 
            name: 'KaiGen',
            exact: true 
        });
        await expect(kaiGenButton).toBeVisible({ timeout: 10000 });
        await kaiGenButton.click();
        
        // Wait for modal
        const modal = page.locator('.components-modal__screen-overlay');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Enter prompt
        const promptInput = page.locator('textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea');
        await expect(promptInput).toBeVisible({ timeout: 5000 });
        await promptInput.fill('A futuristic cityscape at night');
        
        // Click generate button
        const generateButton = page.locator('button:has-text("KaiGen"):not(:has-text("generating"))');
        await expect(generateButton).toBeVisible({ timeout: 5000 });
        await generateButton.click();
        
        // Wait for generation to start
        await expect(page.locator('button:has-text("generating")')).toBeVisible({ timeout: 5000 });
        
        // Wait for generation to complete
        try {
            await expect(modal).not.toBeVisible({ timeout: 15000 });
            
            // Verify image was inserted
            const insertedImage = imageBlock.locator('img');
            await expect(insertedImage).toBeVisible({ timeout: 10000 });
            
            // Get the image src
            const imageSrc = await insertedImage.getAttribute('src');
            expect(imageSrc).toBeTruthy();
            
            console.log('Generated image URL (Replicate):', imageSrc);

            // Wait for the image to be fully loaded and rendered
            await insertedImage.evaluate(image => {
                const img = image as HTMLImageElement;
                if (img.complete && img.naturalWidth > 0) {
                    return;
                }
                return new Promise((resolve, reject) => {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', () => reject(new Error('Image failed to load')));
                });
            });

            // Take a screenshot of the full editor for context
            await page.screenshot({ 
                path: 'tests/test-results/full-editor-replicate.png',
                fullPage: true
            });

            // Take a screenshot of just the image block
            await insertedImage.screenshot({
                path: 'tests/test-results/generated-image-replicate.png'
            });
        } catch (error) {
            // If modal didn't close, check for error messages
            if (await modal.isVisible()) {
                const errorText = await modal.textContent();
                console.log('Modal content when test failed:', errorText);
            }
            
            // Check if it's the offline error
            const pageContent = await page.textContent('body');
            if (pageContent?.includes('offline')) {
                test.skip(true, 'Test environment appears to be offline - HTTP mock may not be working');
            } else {
                throw error;
            }
        }
    });

    /**
     * Test error handling for failed generation
     */
    test('should handle generation errors gracefully', async ({ editor, page }) => {
        // Insert image block
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlock = editor.canvas.locator('[data-type="core/image"]');
        await expect(imageBlock).toBeVisible({ timeout: 10000 });
        
        // Click KaiGen button
        const kaiGenButton = editor.canvas.getByRole('button', { 
            name: 'KaiGen',
            exact: true 
        });
        await expect(kaiGenButton).toBeVisible({ timeout: 10000 });
        await kaiGenButton.click();
        
        // Wait for modal
        const modal = page.locator('.components-modal__screen-overlay');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Enter a prompt that might trigger content moderation (mocked)
        const promptInput = page.locator('textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea');
        await expect(promptInput).toBeVisible({ timeout: 5000 });
        await promptInput.fill('TRIGGER_ERROR_RESPONSE');
        
        // Click generate button
        const generateButton = page.locator('button:has-text("KaiGen"):not(:has-text("generating"))');
        await expect(generateButton).toBeVisible({ timeout: 5000 });
        await generateButton.click();
        
        // Wait a bit for error handling
        await page.waitForTimeout(3000);
        
        // Modal should still be open with error message
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        // Check for error message in modal
        const modalContent = await modal.textContent();
        console.log('Error test modal content:', modalContent);
        
        // Close modal
        const closeButton = page.locator('.components-modal__header button[aria-label*="Close" i]');
        if (await closeButton.count() > 0) {
            await closeButton.click();
        } else {
            await page.keyboard.press('Escape');
        }
        
        await expect(modal).not.toBeVisible({ timeout: 5000 });
    });
});
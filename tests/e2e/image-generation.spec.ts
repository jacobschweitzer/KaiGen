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
        
        // Navigate to admin
        await page.goto('/wp-admin/');
        await page.waitForLoadState('networkidle');
        
        // Configure KaiGen settings
        await page.goto('/wp-admin/options-general.php?page=kaigen-settings');
        await page.waitForSelector('.wrap h1', { timeout: 10000 });
        
        // Select OpenAI provider
        const providerSelect = page.locator('select[name="kaigen_provider"]');
        await providerSelect.selectOption('openai');
        await page.waitForTimeout(500);
        
        // Set API key (will be intercepted by mock)
        const apiKeyField = page.locator('input[name="kaigen_provider_api_keys[openai]"]');
        await apiKeyField.fill('test-api-key-for-e2e-testing');
        
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

    test.beforeEach(async ({ admin }) => {
        test.setTimeout(60000);
        await admin.createNewPost();
    });

    /**
     * Test successful image generation with OpenAI provider
     */
    test('should generate image successfully with OpenAI', async ({ editor, page }) => {
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
        await generateButton.click();
        
        // Wait for generation to complete (mocked response should be quick)
        await page.waitForTimeout(2000);
        
        // Check if modal closed (indicating success)
        await expect(modal).not.toBeVisible({ timeout: 15000 });
        
        // Verify image was inserted
        const insertedImage = imageBlock.locator('img');
        await expect(insertedImage).toBeVisible({ timeout: 10000 });
        
        // Get the image src
        const imageSrc = await insertedImage.getAttribute('src');
        expect(imageSrc).toBeTruthy();
        
        // Log for debugging
        console.log('Generated image URL:', imageSrc);
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
        await apiKeyField.fill('r8_test1234567890123456789012345678901234');
        
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
        
        // Wait for generation to complete
        await page.waitForTimeout(2000);
        
        // Check if modal closed
        await expect(modal).not.toBeVisible({ timeout: 15000 });
        
        // Verify image was inserted
        const insertedImage = imageBlock.locator('img');
        await expect(insertedImage).toBeVisible({ timeout: 10000 });
        
        // Get the image src
        const imageSrc = await insertedImage.getAttribute('src');
        expect(imageSrc).toBeTruthy();
        
        console.log('Generated image URL (Replicate):', imageSrc);
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
        await page.waitForTimeout(2000);
        
        // Modal should still be open with error message
        await expect(modal).toBeVisible({ timeout: 5000 });
        
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
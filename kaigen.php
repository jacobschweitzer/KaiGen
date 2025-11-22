<?php
/**
 * Plugin Name:       KaiGen
 * Description:       A plugin to generate images using AI.
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           0.2.4
 * Author:            Jacob Schweitzer
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kaigen
 *
 * @category Plugin
 * @package  KaiGen
 * @author   Jacob Schweitzer <jacoballanschweitzer@gmail.com>
 * @license  GPL-2.0-or-later https://www.gnu.org/licenses/gpl-2.0.html
 * @link     https://jacobschweitzer.com/kaigen
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants
define( 'KAIGEN_PLUGIN_FILE', __FILE__ );

// Load base classes and interfaces
require_once __DIR__ . '/inc/class-image-handler.php';
require_once __DIR__ . '/inc/interface-image-provider.php';
require_once __DIR__ . '/inc/class-image-provider.php';

// Load provider manager and admin classes
require_once __DIR__ . '/inc/class-provider-manager.php';
require_once __DIR__ . '/inc/class-admin.php';

// Load REST API functionality
require_once __DIR__ . '/inc/class-rest-api.php';

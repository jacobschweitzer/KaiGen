<?php
/**
 * Plugin Name:       KaiGen
 * Description:       A plugin to generate images using AI.
 * Requires at least: 7.0
 * Requires PHP:      7.4
 * Version:           0.2.11
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

namespace KaiGen;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'KAIGEN_PLUGIN_FILE', __FILE__ );
define( 'KAIGEN_VERSION', '0.2.11' );

// Load the small Core AI Client integration.
require_once __DIR__ . '/inc/class-image-handler.php';
require_once __DIR__ . '/inc/class-image-generation-http-options.php';
require_once __DIR__ . '/inc/class-image-generation-service.php';
require_once __DIR__ . '/inc/class-admin.php';
require_once __DIR__ . '/inc/class-rest-api.php';

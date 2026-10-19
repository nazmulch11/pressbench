import type { ProjectFsSeed } from '@/lib/fs';

/**
 * The project the workspace opens with until Phase 7 brings real projects. Small on purpose: enough to show
 * folders, several file types and nesting.
 */
export const DEMO_PROJECT: ProjectFsSeed = {
  files: {
    'my-plugin/my-plugin.php': `<?php
/**
 * Plugin Name: My Plugin
 * Description: Built in Pressbench.
 * Version:     0.1.0
 * License:     GPL-2.0-or-later
 * Text Domain: my-plugin
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/class-my-plugin.php';

add_action( 'plugins_loaded', array( 'My_Plugin', 'init' ) );
`,
    'my-plugin/includes/class-my-plugin.php': `<?php
defined( 'ABSPATH' ) || exit;

class My_Plugin {
	public static function init() {
		add_action( 'admin_notices', array( __CLASS__, 'notice' ) );
	}

	public static function notice() {
		echo '<div class="notice notice-success"><p>' . esc_html__( 'Hello from My Plugin.', 'my-plugin' ) . '</p></div>';
	}
}
`,
    'my-plugin/assets/style.css': `.my-plugin-notice {
	font-weight: 600;
}
`,
    'my-plugin/readme.txt': `=== My Plugin ===
Contributors: you
Requires at least: 6.5
Tested up to: 6.8
Stable tag: 0.1.0
License: GPLv2 or later

A plugin built in Pressbench.
`,
  },
};

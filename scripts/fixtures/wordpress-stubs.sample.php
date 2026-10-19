<?php
/**
 * Generated stub declarations for WordPress.
 * @see https://wordpress.org
 * @see https://github.com/php-stubs/wordpress-stubs
 */

namespace {
    /**
     * A class whose methods must not be mistaken for functions.
     *
     * @since 2.8.0
     */
    #[\AllowDynamicProperties]
    class WP_Upgrader_Skin
    {
        /**
         * Sets the relationship between the skin being used and the upgrader.
         *
         * @since 2.8.0
         *
         * @param WP_Upgrader $upgrader
         */
        public function set_upgrader(&$upgrader)
        {
        }
    }
    /**
     * Enqueues a script.
     *
     * Registers the script if `$src` provided (does NOT overwrite), and enqueues it.
     *
     * @see WP_Dependencies::enqueue()
     *
     * @since 2.1.0
     * @since 6.3.0 The $in_footer parameter of type boolean was overloaded to be an $args parameter of type array.
     *
     * @param string           $handle Name of the script. Should be unique.
     * @param string           $src    Full URL of the script, or path of the script relative to the WordPress root directory.
     *                                 Default empty.
     * @param string[]         $deps   Optional. An array of registered script handles this script depends on. Default empty array.
     * @param string|bool|null $ver    Optional. String specifying script version number, if it has one, which is added to the URL
     *                                 as a query string for cache busting purposes.
     * @param array|bool $args {
     *     Optional. An array of extra args for the script. Default empty array.
     *
     *     @type string $strategy            Optional. If provided, may be either 'defer' or 'async'.
     * }
     *
     * @phpstan-param non-empty-string $handle
     */
    function wp_enqueue_script($handle, $src = '', $deps = array(), $ver = \false, $args = array())
    {
    }
    /**
     * Enqueues a CSS stylesheet.
     *
     * @since 2.6.0
     *
     * @param string           $handle Name of the stylesheet. Should be unique.
     * @param string           $src    Full URL of the stylesheet, or path of the stylesheet relative to the WordPress root directory.
     *                                 Default empty.
     * @param string[]         $deps   Optional. An array of registered stylesheet handles this stylesheet depends on. Default empty array.
     * @param string|bool|null $ver    Optional. String specifying stylesheet version number, if it has one, which is added to the URL
     *                                 as a query string for cache busting purposes. If version is set to false, a version
     *                                 number is automatically added equal to current installed WordPress version.
     *                                 If set to null, no version is added.
     * @param string           $media  Optional. The media for which this stylesheet has been defined.
     *                                 Default 'all'. Accepts media types like 'all', 'print' and 'screen', or media queries like
     *                                 '(orientation: portrait)' and '(max-width: 640px)'.
     */
    function wp_enqueue_style($handle, $src = '', $deps = array(), $ver = \false, $media = 'all')
    {
    }
    /**
     * Retrieves an option value based on an option name.
     *
     * If the option does not exist, and a default value is not provided,
     * boolean false is returned.
     *
     * @since 1.5.0
     *
     * @global wpdb $wpdb WordPress database abstraction object.
     *
     * @param string $option        Name of the option to retrieve. Expected to not be SQL-escaped.
     * @param mixed  $default_value Optional. Default value to return if the option does not exist.
     * @return mixed Value of the option. A value of any type may be returned, including
     *               scalar (string, boolean, float, integer), null, array, object.
     */
    function get_option($option, $default_value = \false)
    {
    }
    /**
     * Installs the site.
     *
     * Runs the required functions to set up and populate the database,
     * including primary admin user and initial options.
     *
     * @since 2.1.0
     *
     * @param string $blog_title    Site title.
     * @param string $user_name     User's username.
     * @param string $user_email    User's email.
     * @param bool   $is_public     Whether the site is public.
     * @param string $deprecated    Optional. Not used.
     * @param string $user_password Optional. User password. Default empty.
     * @param string $language      Optional. Language chosen. Default empty.
     * @return array {
     *     Data for the newly installed site.
     *
     *     @type string $url              The URL of the site.
     * }
     */
    function wp_install(
        $blog_title,
        $user_name,
        $user_email,
        $is_public,
        $deprecated = '',
        #[\SensitiveParameter] $user_password = '',
        $language = ''
    )
    {
    }
    /**
     * Registers an ability.
     *
     * @since 7.0.0
     *
     * @param string $name The ability name.
     * @param array  $args The ability arguments.
     * @return WP_Ability|null The registered ability, or null on failure.
     */
    function wp_register_ability(string $name, array $args): ?\WP_Ability
    {
    }
    /**
     * Retrieves the current user object.
     *
     * @since 2.0.3
     * @deprecated 3.2.0 Use wp_get_current_user()
     * @see wp_get_current_user()
     *
     * @return WP_User Current WP_User instance.
     */
    function get_currentuserinfo()
    {
    }
    /**
     * Private helper that must not show up in completion.
     *
     * @since 4.0.0
     * @access private
     *
     * @param string $value A value.
     */
    function _wp_private_helper($value)
    {
    }
    function wp_undocumented($thing, $flags = 0)
    {
    }
    /** @deprecated Use wp_undocumented() instead. */
    function wp_one_liner($thing)
    {
    }
    /** @deprecated 2.0.0 */
    class_alias('WP_Upgrader_Skin', 'WP_Upgrader_Skin_Alias');
    /**
     * Adds a callback function to an action hook.
     *
     * @since 1.2.0
     *
     * @param string   $hook_name       The name of the action to add the callback to.
     * @param callable $callback        The callback to be run when the action is called.
     * @param int      $priority        Optional. Used to specify the order in which the functions
     *                                  associated with a particular action are executed.
     *                                  Default 10.
     * @param int      $accepted_args   Optional. The number of arguments the function accepts. Default 1.
     * @return true Always returns true.
     */
    function add_action($hook_name, $callback, $priority = 10, $accepted_args = 1)
    {
    }
}
namespace PHPMailer\PHPMailer {
    /**
     * A function in another namespace must be ignored.
     *
     * @since 1.0.0
     */
    function namespaced_helper($x)
    {
    }
}

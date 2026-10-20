import type { WordPressData } from '@/lib/wp-data';

/** A slice of the generated data, enough for completion and hover tests. */
export const WP_DATA_FIXTURE: WordPressData = {
  functions: [
    {
      name: 'wp_enqueue_script',
      signature: "( $handle, $src = '', $deps = array(), $ver = false, $args = array() )",
      summary: 'Enqueues a script.',
      params: [
        { name: '$handle', type: 'string', description: 'Name of the script.' },
        { name: '$src', type: 'string', description: 'Full URL of the script.' },
        { name: '$deps', type: 'string[]', description: 'Optional. Registered script handles.' },
        { name: '$ver', type: 'string|bool|null', description: 'Optional. Version number.' },
        { name: '$args', type: 'array|bool', description: 'Optional. Extra args.' },
      ],
      since: '2.1.0',
    },
    {
      name: 'wp_enqueue_style',
      signature: "( $handle, $src = '', $deps = array(), $ver = false, $media = 'all' )",
      summary: 'Enqueues a CSS stylesheet.',
      params: [{ name: '$handle', type: 'string', description: 'Name of the stylesheet.' }],
      since: '2.6.0',
    },
    {
      name: 'get_option',
      signature: '( $option, $default_value = false )',
      summary: 'Retrieves an option value based on an option name.',
      params: [
        { name: '$option', type: 'string', description: 'Name of the option to retrieve.' },
        { name: '$default_value', type: 'mixed', description: 'Optional. Default value.' },
      ],
      returns: 'mixed',
      since: '1.5.0',
    },
    {
      name: 'get_currentuserinfo',
      signature: '()',
      summary: 'Retrieves the current user object.',
      params: [],
      returns: 'WP_User',
      since: '2.0.3',
      deprecated: '3.2.0',
    },
    {
      name: 'add_action',
      signature: '( $hook_name, $callback, $priority = 10, $accepted_args = 1 )',
      summary: 'Adds a callback function to an action hook.',
      params: [
        { name: '$hook_name', type: 'string', description: 'The name of the action.' },
        { name: '$callback', type: 'callable', description: 'The callback to be run.' },
        { name: '$priority', type: 'int', description: 'Optional. Order of execution.' },
        { name: '$accepted_args', type: 'int', description: 'Optional. Number of arguments.' },
      ],
      returns: 'true',
      since: '1.2.0',
    },
  ],
  hooks: [
    {
      name: 'admin_init',
      type: 'action',
      summary: 'Fires as an admin screen or script is being initialized.',
      params: [],
      since: '2.5.0',
    },
    {
      name: 'init',
      type: 'action',
      summary: 'Fires after WordPress has finished loading but before any headers are sent.',
      params: [],
      since: '1.5.0',
    },
    {
      name: 'wpmu_new_blog',
      type: 'action',
      summary: 'Fires immediately after a new site is created.',
      params: [{ name: '$site_id', type: 'int', description: 'Site ID.' }],
      since: 'MU (3.0.0)',
      deprecated: '5.1.0',
    },
    {
      name: 'the_content',
      type: 'filter',
      summary: 'Filters the post content.',
      params: [{ name: '$content', type: 'string', description: 'Content of the current post.' }],
      since: '0.71',
    },
    {
      name: 'the_title',
      type: 'filter',
      summary: 'Filters the post title.',
      params: [
        { name: '$post_title', type: 'string', description: 'The post title.' },
        { name: '$post_id', type: 'int', description: 'The post ID.' },
      ],
      since: '0.71',
    },
  ],
};

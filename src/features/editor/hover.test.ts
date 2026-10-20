import { describe, expect, it } from 'vitest';

import { WP_DATA_FIXTURE } from '@/test/wp-data-fixture';

import { functionDocsUrl, hookDocsUrl } from './docs-links';
import { hookAtPosition } from './hook-context';
import { functionHover, hookHover } from './hover';

describe('hover', () => {
  it('TC-ED-007 shows the signature, parameters, description and reference link of a function', () => {
    const hover = functionHover('get_option', WP_DATA_FIXTURE);

    expect(hover?.contents).toEqual([
      '```php\nget_option( $option, $default_value = false ): mixed\n```',
      '**Parameters**\n\n- `$option` (string): Name of the option to retrieve.\n- `$default_value` (mixed): Optional. Default value.',
      'Retrieves an option value based on an option name.\n\nSince 1.5.0.\n\n[developer.wordpress.org](https://developer.wordpress.org/reference/functions/get_option/)',
    ]);
    expect(functionHover('get_currentuserinfo', WP_DATA_FIXTURE)?.contents).toEqual([
      '```php\nget_currentuserinfo(): WP_User\n```',
      'Retrieves the current user object.\n\nSince 2.0.3. Deprecated since 3.2.0.\n\n[developer.wordpress.org](https://developer.wordpress.org/reference/functions/get_currentuserinfo/)',
    ]);
    expect(functionHover('my_own_function', WP_DATA_FIXTURE)).toBeNull();
  });

  it('TC-ED-007a shows hook docs for a quoted hook name inside a hook call', () => {
    const line = "add_action( 'init', 'my_init' ); add_filter( 'the_content', 'f' );";

    expect(hookAtPosition(line, 14)).toEqual({
      type: 'action',
      name: 'init',
      startColumn: 14,
      endColumn: 18,
    });
    expect(hookAtPosition(line, 18)).toMatchObject({ name: 'init' });
    expect(hookAtPosition(line, 19)).toBeNull();
    expect(hookAtPosition(line, 25)).toBeNull();
    expect(hookAtPosition(line, 50)).toMatchObject({ type: 'filter', name: 'the_content' });
    expect(hookAtPosition("echo 'init';", 8)).toBeNull();

    expect(hookHover('init', 'action', WP_DATA_FIXTURE)?.contents).toEqual([
      '**init** (WordPress action)',
      'Fires after WordPress has finished loading but before any headers are sent.\n\nSince 1.5.0.\n\n[developer.wordpress.org](https://developer.wordpress.org/reference/hooks/init/)',
    ]);
    expect(hookHover('the_content', 'filter', WP_DATA_FIXTURE)?.contents[1]).toBe(
      '**Parameters**\n\n- `$content` (string): Content of the current post.',
    );
    expect(hookHover('the_content', 'action', WP_DATA_FIXTURE)).toBeNull();
  });

  it('TC-ED-007b links functions and hooks, including dynamic hook names, to the code reference', () => {
    expect(functionDocsUrl('get_option')).toBe(
      'https://developer.wordpress.org/reference/functions/get_option/',
    );
    expect(hookDocsUrl('init')).toBe('https://developer.wordpress.org/reference/hooks/init/');
    expect(hookDocsUrl('activate_{$plugin}')).toBe(
      'https://developer.wordpress.org/reference/hooks/activate_plugin/',
    );
    expect(hookDocsUrl('{$new_status}_{$post->post_type}')).toBe(
      'https://developer.wordpress.org/reference/hooks/new_status_post-post_type/',
    );
    expect(hookDocsUrl('customize_preview_{$this->id}')).toBe(
      'https://developer.wordpress.org/reference/hooks/customize_preview_this-id/',
    );
  });
});

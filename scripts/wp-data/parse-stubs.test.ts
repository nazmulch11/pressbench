// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseStubs } from './parse-stubs';

const SAMPLE = readFileSync(
  new URL('../fixtures/wordpress-stubs.sample.php', import.meta.url),
  'utf8',
);

describe('parseStubs', () => {
  it('TC-ED-015 extracts global functions with signatures, docs and params', () => {
    const functions = parseStubs(SAMPLE);
    const byName = new Map(functions.map((fn) => [fn.name, fn]));

    expect([...byName.keys()]).toEqual([
      'wp_enqueue_script',
      'wp_enqueue_style',
      'get_option',
      'wp_install',
      'wp_register_ability',
      'get_currentuserinfo',
      'wp_undocumented',
      'wp_one_liner',
      'add_action',
    ]);

    const enqueue = byName.get('wp_enqueue_script');
    expect(enqueue).toMatchObject({
      signature: "( $handle, $src = '', $deps = array(), $ver = false, $args = array() )",
      summary: 'Enqueues a script.',
      since: '2.1.0',
    });
    expect(enqueue?.params).toEqual([
      { name: '$handle', type: 'string', description: 'Name of the script.' },
      {
        name: '$src',
        type: 'string',
        description:
          'Full URL of the script, or path of the script relative to the WordPress root directory.',
      },
      {
        name: '$deps',
        type: 'string[]',
        description: 'Optional. An array of registered script handles this script depends on.',
      },
      {
        name: '$ver',
        type: 'string|bool|null',
        description:
          'Optional. String specifying script version number, if it has one, which is added to the URL as a query string for cache busting purposes.',
      },
      {
        name: '$args',
        type: 'array|bool',
        description: 'Optional. An array of extra args for the script.',
      },
    ]);
    expect(enqueue).not.toHaveProperty('deprecated');
    expect(enqueue).not.toHaveProperty('returns');

    expect(byName.get('get_option')).toMatchObject({
      signature: '( $option, $default_value = false )',
      summary: 'Retrieves an option value based on an option name.',
      returns: 'mixed',
      since: '1.5.0',
    });
  });

  it('TC-ED-015a handles multi-line and typed signatures and return types', () => {
    const byName = new Map(parseStubs(SAMPLE).map((fn) => [fn.name, fn]));

    expect(byName.get('wp_install')?.signature).toBe(
      "( $blog_title, $user_name, $user_email, $is_public, $deprecated = '', $user_password = '', $language = '' )",
    );
    expect(byName.get('wp_install')?.returns).toBe('array');
    expect(byName.get('wp_register_ability')).toMatchObject({
      signature: '( string $name, array $args )',
      returns: '?WP_Ability',
      params: [
        { name: '$name', type: 'string', description: 'The ability name.' },
        { name: '$args', type: 'array', description: 'The ability arguments.' },
      ],
    });
  });

  it('TC-ED-015b flags deprecated functions, skips private ones and keeps undocumented ones', () => {
    const byName = new Map(parseStubs(SAMPLE).map((fn) => [fn.name, fn]));

    expect(byName.get('get_currentuserinfo')).toMatchObject({
      deprecated: '3.2.0',
      returns: 'WP_User',
    });
    expect(byName.has('_wp_private_helper')).toBe(false);
    expect(byName.has('namespaced_helper')).toBe(false);
    expect(byName.has('set_upgrader')).toBe(false);
    expect(byName.get('wp_one_liner')).toEqual({
      name: 'wp_one_liner',
      signature: '( $thing )',
      summary: '',
      params: [{ name: '$thing' }],
      deprecated: '',
    });
    expect(byName.get('wp_undocumented')).toEqual({
      name: 'wp_undocumented',
      signature: '( $thing, $flags = 0 )',
      summary: '',
      params: [{ name: '$thing' }, { name: '$flags' }],
    });
  });
});

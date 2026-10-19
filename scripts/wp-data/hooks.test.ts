// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { convertHooks, type HooksJson } from './hooks';

const ACTIONS: HooksJson = {
  hooks: [
    {
      name: 'init',
      file: 'wp-settings.php',
      type: 'action',
      doc: {
        description: 'Fires after WordPress has finished loading but before any headers are sent.',
        long_description: 'Most of WP is loaded at this stage.',
        tags: [{ name: 'since', content: '1.5.0' }],
      },
      args: 0,
    },
    {
      name: 'admin_init',
      file: 'wp-admin/admin.php',
      type: 'action',
      doc: {
        description: 'Fires as an admin screen or script is being initialized.',
        long_description: '',
        tags: [{ name: 'since', content: '2.5.0' }],
      },
      args: 0,
    },
    {
      name: 'admin_init',
      file: 'wp-admin/admin-ajax.php',
      type: 'action',
      doc: { description: 'Duplicate entry from another file.', long_description: '', tags: [] },
      args: 0,
    },
    {
      name: 'wpmu_new_blog',
      file: 'wp-includes/ms-functions.php',
      type: 'action',
      doc: {
        description: 'Fires immediately after a new site is created.',
        long_description: '',
        tags: [
          { name: 'since', content: 'MU (3.0.0)' },
          { name: 'deprecated', content: "5.1.0 Use {@see 'wp_initialize_site'} instead." },
          { name: 'param', content: 'Site ID.', types: ['int'], variable: '$site_id' },
        ],
      },
      args: 1,
    },
  ],
};

const FILTERS: HooksJson = {
  hooks: [
    {
      name: 'the_content',
      file: 'wp-includes/post-template.php',
      type: 'filter',
      doc: {
        description: 'Filters the post content.',
        long_description: '',
        tags: [
          { name: 'since', content: '0.71' },
          {
            name: 'param',
            content: 'Content of the current post. Can be long.',
            types: ['string'],
            variable: '$content',
          },
        ],
      },
      args: 1,
    },
  ],
};

describe('convertHooks', () => {
  it('TC-ED-016 converts actions and filters, removes duplicates and flags deprecated hooks', () => {
    const hooks = convertHooks(ACTIONS, FILTERS);

    expect(hooks.map((hook) => `${hook.type}:${hook.name}`)).toEqual([
      'action:admin_init',
      'action:init',
      'action:wpmu_new_blog',
      'filter:the_content',
    ]);
    expect(hooks.find((hook) => hook.name === 'init')).toEqual({
      name: 'init',
      type: 'action',
      summary: 'Fires after WordPress has finished loading but before any headers are sent.',
      params: [],
      since: '1.5.0',
    });
    expect(hooks.find((hook) => hook.name === 'the_content')).toEqual({
      name: 'the_content',
      type: 'filter',
      summary: 'Filters the post content.',
      params: [{ name: '$content', type: 'string', description: 'Content of the current post.' }],
      since: '0.71',
    });
    expect(hooks.find((hook) => hook.name === 'wpmu_new_blog')).toMatchObject({
      since: 'MU (3.0.0)',
      deprecated: '5.1.0',
      params: [{ name: '$site_id', type: 'int', description: 'Site ID.' }],
    });
  });
});

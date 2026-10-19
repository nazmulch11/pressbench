import { describe, expect, it } from 'vitest';

import { WP_DATA_FIXTURE } from '@/test/wp-data-fixture';

import { suggest, type CompletionQuery } from './completion';

/** Builds a query from a line with `|` marking the cursor; the word is the identifier before the cursor. */
function at(lineWithCursor: string): CompletionQuery {
  const cursor = lineWithCursor.indexOf('|');
  const lineBeforeCursor = lineWithCursor.slice(0, cursor);
  const word = /[\w$]*$/.exec(lineBeforeCursor)?.[0] ?? '';
  return {
    lineBeforeCursor,
    lineAfterCursor: lineWithCursor.slice(cursor + 1),
    word,
    wordStartColumn: lineBeforeCursor.length - word.length + 1,
  };
}

describe('suggest', () => {
  it('TC-ED-003 suggests WordPress functions with signatures for a partial name', () => {
    const result = suggest(at('    wp_enq|'), WP_DATA_FIXTURE);

    expect(result.incomplete).toBe(true);
    expect(result.suggestions.map((item) => item.label)).toEqual([
      'wp_enqueue_script',
      'wp_enqueue_style',
    ]);
    expect(result.suggestions[0]).toMatchObject({
      kind: 'function',
      detail:
        "wp_enqueue_script( $handle, $src = '', $deps = array(), $ver = false, $args = array() )",
      insertText: 'wp_enqueue_script( $0 )',
      isSnippet: true,
      deprecated: false,
      sortText: '0wp_enqueue_script',
      startColumn: 5,
    });
    expect(result.suggestions[0]?.documentation).toContain('Enqueues a script.');
    expect(result.suggestions[0]?.documentation).toContain(
      'https://developer.wordpress.org/reference/functions/wp_enqueue_script/',
    );
  });

  it('TC-ED-003a marks deprecated functions, sorts them last and skips the parens before an existing call', () => {
    const result = suggest(at('get_|( 1 )'), WP_DATA_FIXTURE);

    expect(result.suggestions.map((item) => item.label)).toEqual([
      'get_option',
      'get_currentuserinfo',
    ]);
    expect(result.suggestions[0]).toMatchObject({ insertText: 'get_option', isSnippet: false });
    expect(result.suggestions[1]).toMatchObject({
      deprecated: true,
      sortText: '1get_currentuserinfo',
    });
    expect(result.suggestions[1]?.documentation).toContain('Deprecated since 3.2.0.');
    const noParams = suggest(at('currentuser|'), WP_DATA_FIXTURE);
    expect(noParams.suggestions[0]).toMatchObject({
      insertText: 'get_currentuserinfo()',
      isSnippet: false,
    });
  });

  it('TC-ED-004 suggests action hooks inside add_action', () => {
    const result = suggest(at("add_action( 'ini|"), WP_DATA_FIXTURE);

    expect(result.suggestions.map((item) => item.label)).toEqual(['admin_init', 'init']);
    expect(result.suggestions[1]).toMatchObject({
      kind: 'action',
      insertText: 'init',
      isSnippet: false,
      detail: 'WordPress action',
      startColumn: 14,
    });
    expect(result.suggestions[1]?.documentation).toContain(
      'https://developer.wordpress.org/reference/hooks/init/',
    );

    const all = suggest(at('do_action("|'), WP_DATA_FIXTURE);
    expect(all.suggestions.map((item) => item.label)).toEqual([
      'admin_init',
      'init',
      'wpmu_new_blog',
    ]);
    expect(all.suggestions[2]).toMatchObject({ deprecated: true, sortText: '1wpmu_new_blog' });
    expect(suggest(at("remove_action( 'admin|"), WP_DATA_FIXTURE).suggestions[0]?.label).toBe(
      'admin_init',
    );
  });

  it('TC-ED-005 suggests filter hooks inside add_filter and never action-only hooks', () => {
    const result = suggest(at("add_filter( 'the_con|"), WP_DATA_FIXTURE);

    expect(result.suggestions.map((item) => item.label)).toEqual(['the_content']);
    expect(result.suggestions[0]).toMatchObject({ kind: 'filter', detail: 'WordPress filter' });

    const filters = suggest(at("$x = apply_filters( '|"), WP_DATA_FIXTURE);
    expect(filters.suggestions.map((item) => item.label)).toEqual(['the_content', 'the_title']);
    expect(suggest(at("add_filter( 'init|"), WP_DATA_FIXTURE).suggestions).toEqual([]);
    expect(suggest(at("remove_filter( 'title|"), WP_DATA_FIXTURE).suggestions[0]?.label).toBe(
      'the_title',
    );
  });

  it('TC-ED-006 suggests nothing inside other strings or with no word', () => {
    expect(suggest(at("echo 'init|"), WP_DATA_FIXTURE).suggestions).toEqual([]);
    expect(suggest(at("my_action( 'init|"), WP_DATA_FIXTURE).suggestions).toEqual([]);
    expect(suggest(at('echo "get_op|'), WP_DATA_FIXTURE).suggestions).toEqual([]);
    expect(suggest(at("$a = 'x'; get_op|"), WP_DATA_FIXTURE).suggestions).toHaveLength(1);
    expect(suggest(at('    |'), WP_DATA_FIXTURE)).toEqual({ suggestions: [], incomplete: false });
  });
});

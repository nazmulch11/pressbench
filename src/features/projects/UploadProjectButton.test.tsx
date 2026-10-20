import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { ZIP_LIMITS } from '@/lib/zip';
import { createWorkspaceStore, WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';

import { importSummary, UploadProjectButton } from './UploadProjectButton';

const PLUGIN_MAIN = '<?php\n/**\n * Plugin Name: Hello Pressbench\n */\n';

function zipFile(name: string, entries: Record<string, string | Uint8Array>): File {
  const flat: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    flat[path] = typeof content === 'string' ? strToU8(content) : content;
  }
  return new File([zipSync(flat)], name, { type: 'application/zip' });
}

function renderButton(options: Parameters<typeof userEvent.setup>[0] = {}): {
  store: WorkspaceStore;
  user: ReturnType<typeof userEvent.setup>;
} {
  const store = createWorkspaceStore();
  render(
    <WorkspaceStoreProvider store={store}>
      <UploadProjectButton />
    </WorkspaceStoreProvider>,
  );
  return { store, user: userEvent.setup(options) };
}

const input = () => screen.getByLabelText<HTMLInputElement>('Plugin or theme zip file');

async function upload(user: ReturnType<typeof userEvent.setup>, file: File): Promise<void> {
  await act(async () => {
    await user.upload(input(), file);
  });
}

describe('UploadProjectButton', () => {
  it('TC-PRJ-016a imports a plugin zip and reports what it did', async () => {
    const { store, user } = renderButton();
    const file = zipFile('hello.zip', {
      'hello-pressbench/hello-pressbench.php': PLUGIN_MAIN,
      'hello-pressbench/readme.txt': 'Hi',
      'hello-pressbench/icon.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0xff, 0xfe]),
    });

    await upload(user, file);

    expect(
      await screen.findByText(
        'Imported plugin "hello-pressbench" (2 files). Skipped 1 binary file: hello-pressbench/icon.png.',
      ),
    ).toBeInTheDocument();
    expect(store.getState().activeTab).toBe('hello-pressbench/hello-pressbench.php');
  });

  it('TC-PRJ-016b explains why an unsafe zip was refused', async () => {
    const { store, user } = renderButton();
    const before = store.getState().fs.entries();
    const file = zipFile('evil.zip', { 'p/p.php': PLUGIN_MAIN, 'p/../../x.php': '<?php' });

    await upload(user, file);

    expect(
      await screen.findByText(
        'Could not import evil.zip: The zip contains an unsafe path, "p/../../x.php": it goes outside the project folder.',
      ),
    ).toBeInTheDocument();
    expect(store.getState().fs.entries()).toEqual(before);
  });

  it('TC-PRJ-016c refuses a file that is not a zip, and the same file can be chosen again', async () => {
    // A file picker's "All files" option lets people pick anything, whatever `accept` says.
    const { user } = renderButton({ applyAccept: false });
    const notes = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const refusal = 'Could not import notes.txt: This is not a valid zip file.';

    await upload(user, notes);
    expect(await screen.findByText(refusal)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await upload(user, notes);

    expect(await screen.findByText(refusal)).toBeInTheDocument();
  });

  it('TC-PRJ-016d opens the file picker from the button', async () => {
    const { user } = renderButton();
    let opened = false;
    input().addEventListener('click', () => {
      opened = true;
    });

    await user.click(screen.getByRole('button', { name: 'Upload plugin or theme' }));

    expect(opened).toBe(true);
    expect(input()).toHaveAttribute('accept', '.zip,application/zip');
  });

  it('TC-PRJ-016e lists at most three skipped files in the summary', () => {
    const summary = importSummary({
      kind: 'theme',
      folder: 't',
      mainFile: 't/style.css',
      files: { 't/style.css': '' },
      skipped: ['t/a.png', 't/b.png', 't/c.png', 't/d.png', 't/e.png'],
    });

    expect(summary).toBe(
      'Imported theme "t" (1 file). Skipped 5 binary files: t/a.png, t/b.png, t/c.png and 2 more.',
    );
  });

  it('TC-PRJ-016i Dismiss clears the message', async () => {
    const { user } = renderButton({ applyAccept: false });
    await upload(user, new File(['x'], 'x.txt'));
    await screen.findByText(/Could not import x\.txt/);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText(/Could not import/)).not.toBeInTheDocument();
  });

  it('TC-PRJ-016f refuses a second upload of the same plugin with the folder clash', async () => {
    const { user } = renderButton();
    const file = zipFile('hello.zip', { 'hello/hello.php': PLUGIN_MAIN });
    await upload(user, file);
    await screen.findByText('Imported plugin "hello" (1 file).');

    await upload(user, file);

    expect(
      await screen.findByText(
        'Could not import hello.zip: A folder named "hello" already exists. Rename or delete it, then upload again.',
      ),
    ).toBeInTheDocument();
  });

  it('TC-PRJ-016g reports a file the browser cannot read', async () => {
    const { user } = renderButton();
    const file = zipFile('broken.zip', { 'hello/hello.php': PLUGIN_MAIN });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.reject(new Error('NotReadableError')),
    });

    await upload(user, file);

    expect(
      await screen.findByText('Could not import broken.zip: the file could not be read.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload plugin or theme' })).toBeEnabled();
  });

  it('TC-PRJ-016h refuses a file over the size limit without reading it', async () => {
    const { user } = renderButton();
    const file = zipFile('huge.zip', { 'hello/hello.php': PLUGIN_MAIN });
    Object.defineProperty(file, 'size', { value: ZIP_LIMITS.maxZipBytes + 1 });
    const read = vi.spyOn(file, 'arrayBuffer');

    await upload(user, file);

    expect(
      await screen.findByText('Could not import huge.zip: The zip is larger than 20 MB.'),
    ).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });

  it('TC-PRJ-016j reports a failed import as such, not as a read failure', async () => {
    const { store, user } = renderButton();
    vi.spyOn(store.getState().fs, 'write').mockImplementation(() => {
      throw new RangeError('Maximum call stack size exceeded');
    });

    await upload(user, zipFile('hello.zip', { 'hello/hello.php': PLUGIN_MAIN }));

    expect(
      await screen.findByText(
        'Could not import hello.zip: The project could not be added: Maximum call stack size exceeded',
      ),
    ).toBeInTheDocument();
  });
});

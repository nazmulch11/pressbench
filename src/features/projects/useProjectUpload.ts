import { useCallback, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { checkZipSize, readProjectZip, type ProjectZip } from '@/lib/zip';
import { useWorkspaceStoreApi } from '@/stores';

const log = createLogger('projects');
const LISTED_SKIPS = 3;

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** The sentence shown after a successful import. */
export function importSummary(project: ProjectZip): string {
  const fileCount = Object.keys(project.files).length;
  const imported = `Imported ${project.kind} "${project.folder}" (${plural(fileCount, 'file')}).`;
  if (project.skipped.length === 0) {
    return imported;
  }
  const listed = project.skipped.slice(0, LISTED_SKIPS).join(', ');
  const more =
    project.skipped.length > LISTED_SKIPS
      ? ` and ${String(project.skipped.length - LISTED_SKIPS)} more`
      : '';
  return `${imported} Skipped ${plural(project.skipped.length, 'binary file')}: ${listed}${more}.`;
}

async function readBytes(file: File): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error: unknown) {
    log.error('upload read failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface ProjectUpload {
  /** The last result, as a sentence; empty when there is nothing to show. */
  readonly message: string;
  /**
   * Changes with every message, even an identical one. Used as a React key, the message is a new element each time,
   * so a screen reader announces a repeated refusal.
   */
  readonly messageId: number;
  readonly isBusy: boolean;
  readonly upload: (file: File) => Promise<void>;
  readonly dismiss: () => void;
}

/**
 * Turns a chosen file into a project folder: size check before reading, then `readProjectZip` (all safety checks),
 * then `importProject` in the store. Every outcome ends as one message.
 */
export function useProjectUpload(): ProjectUpload {
  const api = useWorkspaceStoreApi();
  const [notice, setNotice] = useState({ text: '', id: 0 });
  const [isBusy, setBusy] = useState(false);
  const setMessage = useCallback((text: string) => {
    setNotice((current) => ({ text, id: current.id + 1 }));
  }, []);

  const upload = useCallback(
    async (file: File): Promise<void> => {
      setMessage('');
      const refuse = (reason: string): void => {
        setMessage(`Could not import ${file.name}: ${reason}`);
      };
      const size = checkZipSize(file.size);
      if (!size.ok) {
        refuse(size.error.message);
        return;
      }
      setBusy(true);
      try {
        const bytes = await readBytes(file);
        if (bytes === null) {
          refuse('the file could not be read.');
          return;
        }
        const read = await readProjectZip(bytes, file.name);
        if (!read.ok) {
          log.warn('zip refused', { kind: read.error.kind });
          refuse(read.error.message);
          return;
        }
        const project = read.value;
        const imported = api
          .getState()
          .importProject(project.folder, project.files, project.mainFile);
        if (!imported.ok) {
          log.warn('import refused', { kind: imported.error.kind });
          refuse(imported.error.message);
          return;
        }
        log.info('project imported', {
          kind: project.kind,
          files: Object.keys(project.files).length,
          skipped: project.skipped.length,
        });
        setMessage(importSummary(project));
      } finally {
        setBusy(false);
      }
    },
    [api, setMessage],
  );

  const dismiss = useCallback(() => {
    setMessage('');
  }, [setMessage]);

  return { message: notice.text, messageId: notice.id, isBusy, upload, dismiss };
}

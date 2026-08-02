import { readConfig } from '../../../../lib/config.js';
import {
  closeTerminalSession,
  getTerminalSession,
  startTerminalSession,
  writeTerminalInput
} from '../../../../lib/terminal.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Missing terminal session id.' }, { status: 400 });
  const session = getTerminalSession(id);
  if (!session) return Response.json({ ok: false, error: `Unknown terminal session: ${id}` }, { status: 404 });
  return Response.json({ ok: true, session });
}

export async function POST(request) {
  try {
    const { remoteId } = await request.json();
    const config = await readConfig();
    const remote = config.remotes.find(r => r.id === remoteId);
    if (!remote) return Response.json({ ok: false, error: 'Remote not found.' }, { status: 404 });

    const session = await startTerminalSession(remote);
    return Response.json({ ok: true, message: 'Terminal opened.', session }, { status: 202 });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    const { id, input } = await request.json();
    const session = writeTerminalInput(id, input);
    return Response.json({ ok: true, session });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ ok: false, error: 'Missing terminal session id.' }, { status: 400 });
    const session = closeTerminalSession(id);
    if (!session) return Response.json({ ok: false, error: `Unknown terminal session: ${id}` }, { status: 404 });
    return Response.json({ ok: true, session });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
}

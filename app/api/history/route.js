import { NextResponse } from 'next/server';
import { clearHistory, listHistory } from '../../../lib/history';

export async function GET() {
  return NextResponse.json({ history: listHistory() });
}

export async function DELETE() {
  return NextResponse.json({ cleared: clearHistory(), history: listHistory() });
}

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db.js';
import { asTemplate } from '../../../../../lib/db-api.js';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const body = await request.json();
    if (body.parent_template_id === id) return NextResponse.json({ error: 'Template cannot be its own parent' }, { status: 400 });
    const template = await db.template.update({
      where: { id },
      data: {
        name: body.name,
        parentTemplateId: body.parent_template_id || null,
        relativePath: body.relative_path || '',
        relativeRemotePath: body.relative_remote_path || '',
        variableKeys: typeof body.variable_keys === 'string' ? body.variable_keys : JSON.stringify(body.variable_keys || []),
        hidden: Number(body.hidden || 0)
      }
    });
    return NextResponse.json({ template: asTemplate(template) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    if (id === 'default-category') return NextResponse.json({ error: 'Default template cannot be deleted' }, { status: 400 });
    const db = await getDb();
    await db.template.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { getDb } from '../lib/db.js';

const templates = [
  {
    id: 'backend-stream',
    name: 'Backend stream',
    parentTemplateId: null,
    relativePath: './backend/{name}',
    relativeRemotePath: '{project}/{name}',
    variableKeys: ['project', 'name']
  },
  {
    id: 'backend-dir-ssh',
    name: 'Backend dir to SSH',
    parentTemplateId: 'backend-stream',
    relativePath: './backend/{name}',
    relativeRemotePath: '/home/{account}/domains/files_program/user/{project}/{name}',
    variableKeys: ['account', 'project', 'name']
  },
  {
    id: 'backend-dir-share',
    name: 'Backend dir to share',
    parentTemplateId: 'backend-stream',
    relativePath: './backend/{name}',
    relativeRemotePath: '\\\\192.168.100.208\\www\\saha03\\domains\\files_program\\user\\{project}\\{name}',
    variableKeys: ['project', 'name']
  },
  {
    id: 'module-stream',
    name: 'Related module stream',
    parentTemplateId: null,
    relativePath: './module/related moudles/{module}',
    relativeRemotePath: '{project}/{module}',
    variableKeys: ['project', 'module']
  },
  {
    id: 'module-dir-ssh',
    name: 'Module dir to SSH',
    parentTemplateId: 'module-stream',
    relativePath: './module/related moudles/{module}',
    relativeRemotePath: '/home/{account}/domains/files_program/user/{project}/{module}',
    variableKeys: ['account', 'project', 'module']
  },
  {
    id: 'module-dir-share',
    name: 'Module dir to share',
    parentTemplateId: 'module-stream',
    relativePath: './module/related moudles/{module}',
    relativeRemotePath: '\\\\192.168.100.208\\www\\saha03\\domains\\files_program\\user\\{project}\\{module}',
    variableKeys: ['project', 'module']
  },
  {
    id: 'server-files',
    name: 'Server files',
    parentTemplateId: null,
    relativePath: './server/{file}',
    relativeRemotePath: '{remotePath}',
    variableKeys: ['file', 'remotePath']
  },
  {
    id: 'server-file-ssh',
    name: 'Server file to SSH',
    parentTemplateId: 'server-files',
    relativePath: './server/{file}',
    relativeRemotePath: '{remotePath}',
    variableKeys: ['file', 'remotePath']
  }
];

const categoryTemplates = new Map([
  ['googdepost:stream:backend:backend', 'backend-stream'],
  ['iron:stream:backend:backend', 'backend-stream'],
  ['kasb:stream:admin:admin', 'backend-stream'],
  ['shapoorsangin:stream:backend:backend', 'backend-stream'],
  ['talaagahi:stream:backend:backend', 'backend-stream'],
  ['shapoorsangin:stream:aghsat-module:aghsat-module', 'module-stream'],
  ['shapoorsangin:stream:jobsearch-module:jobsearch-module', 'module-stream'],
  ['shapoorsangin:stream:truck-module:truck-module', 'module-stream'],
  ['shapoorsangin:stream:server-files:server-files', 'server-files']
]);

const db = await getDb();

await db.$transaction(async (tx) => {
  for (const template of templates) {
    await tx.template.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        parentTemplateId: template.parentTemplateId,
        relativePath: template.relativePath,
        relativeRemotePath: template.relativeRemotePath,
        variableKeys: JSON.stringify(template.variableKeys),
        hidden: 0
      },
      create: {
        ...template,
        variableKeys: JSON.stringify(template.variableKeys),
        hidden: 0
      }
    });
  }

  for (const [id, templateId] of categoryTemplates) {
    await tx.category.update({ where: { id }, data: { templateId } });
  }

  const mappings = await tx.mapping.findMany({ select: { id: true, type: true, variables: true } });
  for (const mapping of mappings) {
    const vars = JSON.parse(mapping.variables || '{}');
    let templateId = 'default-category';

    if (mapping.type === 'file' && vars.local?.startsWith('./server/')) templateId = 'server-file-ssh';
    else if (vars.local?.includes('./module/related moudles/')) {
      templateId = isSharePath(vars.remote) ? 'module-dir-share' : 'module-dir-ssh';
    } else if (vars.local?.includes('backend') || vars.local?.includes('./backend/')) {
      templateId = isSharePath(vars.remote) ? 'backend-dir-share' : 'backend-dir-ssh';
    }

    if (templateId !== 'default-category') {
      await tx.mapping.update({ where: { id: mapping.id }, data: { templateId } });
    }
  }
});

await db.$disconnect();
console.log(`seeded ${templates.length} useful templates`);

function isSharePath(value = '') {
  return value.startsWith('\\\\') || value.startsWith('./');
}

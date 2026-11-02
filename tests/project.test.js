import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateProject,
  buildPages,
  moveItem,
  newProperty,
  createEmptyProject
} from '../src/lib/project.js';

function testProject() {
  const project = createEmptyProject();

  project.properties = [
    {
      ...newProperty(),
      description: 'Περιγραφή δοκιμής',
      photos: [
        {
          id: 'test-photo',
          src: 'data:image/jpeg;base64,YWJj',
          caption: 'Δοκιμή'
        }
      ]
    }
  ];

  return project;
}

test('new projects start empty and do not share mutable data', () => {
  const a = createEmptyProject();
  const b = createEmptyProject();

  assert.equal(a.properties.length, 0);
  assert.equal(a.presentation.subtitle, '');

  a.properties.push(newProperty());
  a.presentation.title = 'Changed';

  assert.equal(b.properties.length, 0);
  assert.equal(b.presentation.title, 'Επιλεγμένα Ακίνητα');
  assert.deepEqual(
    buildPages(b).map(page => page.type),
    ['cover', 'closing']
  );
});

test('pagination does not lose properties beyond eight', () => {
  const project = createEmptyProject();

  project.properties = Array.from({ length: 17 }, (_, i) => ({
    ...newProperty(),
    id: String(i)
  }));

  const pages = buildPages(project);

  assert.deepEqual(
    pages.filter(page => page.type === 'overview').map(page => page.items.length),
    [8, 8, 1]
  );

  assert.equal(pages.filter(page => page.type === 'property').length, 17);
});

test('excluded properties and disabled sections stay out of PDF', () => {
  const project = testProject();
  project.properties.forEach(property => {
    property.included = false;
  });

  assert.deepEqual(
    buildPages(project).map(page => page.type),
    ['cover', 'closing']
  );

  project.presentation.closing = false;
  assert.equal(buildPages(project).length, 1);
});

test('reorder preserves data and invalid boundaries', () => {
  const items = ['a', 'b', 'c'];

  assert.deepEqual(moveItem(items, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(items, ['a', 'b', 'c']);
  assert.deepEqual(moveItem(items, 0, -1), items);
});

test('portable imports reject remote, svg, and unresolved relative images', () => {
  const invalidSources = [
    'https://example.com/x.png',
    'data:image/svg+xml;base64,abcd',
    'assets/logo.jpg'
  ];

  for (const src of invalidSources) {
    const project = testProject();
    project.presentation.logo = src;

    assert.throws(() => {
      validateProject(project, { portable: true });
    });
  }
});

test('portable project round-trips embedded images and text', () => {
  const project = testProject();
  project.presentation.logo = 'data:image/png;base64,YWJj';

  const validated = validateProject(JSON.parse(JSON.stringify(project)), { portable: true });

  assert.equal(validated.properties[0].photos[0].src, project.properties[0].photos[0].src);

  assert.equal(validated.properties[0].description, project.properties[0].description);
});

test('unknown file versions and oversized property lists are rejected', () => {
  const project = testProject();

  assert.throws(() => {
    validateProject({ ...project, version: 2 });
  });

  assert.throws(() => {
    validateProject({
      ...project,
      properties: Array(41).fill(project.properties[0])
    });
  });
});

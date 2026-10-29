/// <reference types="node" />

// Offline barangay matching (searchBarangays) and the barangay suggestions built from it
// (searchBarangayLocations) for the pickup/destination search. Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getBarangayPinPoint } from '../../src/constants/barangayPinPoints.ts';
import { BARANGAYS, POBLACION_ID } from '../../src/constants/barangays.ts';
import {
  formatBarangayResultLabel,
  normalizeSearchText,
  searchBarangayLocations,
  searchBarangays,
} from '../../src/utils/barangaySearch.ts';

const ids = (text: string) => searchBarangays(text).map((match) => match.id);
const first = (text: string) => searchBarangays(text)[0];

describe('normalizeSearchText', () => {
  it('drops case, accents, punctuation, hyphens and barangay/town words', () => {
    assert.equal(normalizeSearchText('Brgy. Kinan-oan, Trinidad'), 'kinan oan');
    assert.equal(normalizeSearchText('BARANGAY  Sto. Tomás, Bohol, Philippines'), 'sto tomas');
    assert.equal(normalizeSearchText('bgy banlasan'), 'banlasan');
  });
});

describe('searchBarangays', () => {
  it('finds every barangay and Poblacion by its exact name', () => {
    for (const { id, name } of [{ id: POBLACION_ID, name: 'Poblacion' }, ...BARANGAYS]) {
      assert.deepEqual(first(name), { id, name, match: 'exact' }, name);
    }
  });

  it('ignores case, punctuation and "brgy"/"barangay"/"Trinidad"', () => {
    for (const text of ['brgy banlasan', 'Brgy. Banlasan', 'BARANGAY BANLASAN', 'Banlasan, Trinidad, Bohol']) {
      assert.deepEqual(first(text), { id: 'banlasan', name: 'Banlasan', match: 'exact' }, text);
    }
    assert.equal(first('Poblacion, Trinidad')?.id, POBLACION_ID);
    assert.equal(first('Manuel M Roxas')?.match, 'exact');
  });

  it('matches hyphenated names written with or without the hyphen', () => {
    for (const text of ['kinan-oan', 'kinan oan', 'kinanoan', 'Brgy. Kinanoan']) {
      assert.deepEqual(first(text), { id: 'kinan-oan', name: 'Kinan-oan', match: 'exact' }, text);
    }
  });

  it('accepts common short forms', () => {
    assert.equal(first('sto tomas')?.id, 'santo-tomas');
    assert.equal(first('Sto. Tomas')?.match, 'exact');
    assert.equal(first('MM Roxas')?.id, 'manuel-m-roxas');
    assert.equal(first('roxas')?.id, 'manuel-m-roxas');
    assert.equal(first('town proper')?.id, POBLACION_ID);
    assert.equal(first('pob')?.id, POBLACION_ID);
  });

  it('matches the start of a name while typing', () => {
    assert.deepEqual(ids('ban'), ['banlasan']);
    assert.deepEqual(ids('hinlayagan'), ['hinlayagan-ilaud', 'hinlayagan-ilaya']);
    assert.deepEqual(ids('tagum'), ['tagum-norte', 'tagum-sur']);
    assert.equal(first('la vic')?.id, 'la-victoria');
  });

  it('matches a later word of the name', () => {
    assert.deepEqual(first('ilaya'), { id: 'hinlayagan-ilaya', name: 'Hinlayagan Ilaya', match: 'word' });
    assert.deepEqual(first('cabigohan'), {
      id: 'mabuhay-cabigohan',
      name: 'Mabuhay Cabigohan',
      match: 'word',
    });
  });

  it('matches text inside a name from 3 letters', () => {
    const match = searchBarangays('lasan').find(({ id }) => id === 'banlasan');
    assert.equal(match?.match, 'contains');
    assert.equal(searchBarangays('as').some(({ id }) => id === 'banlasan'), false);
  });

  it('tolerates small typos', () => {
    assert.deepEqual(first('banlasn'), { id: 'banlasan', name: 'Banlasan', match: 'typo' });
    assert.equal(first('bangbong')?.id, 'bongbong');
    assert.equal(first('guinobaatn')?.id, 'guinobatan'); // swapped letters
    assert.equal(first('kauswgan')?.id, 'kauswagan');
    assert.equal(first('poblasion')?.id, POBLACION_ID);
    assert.equal(first('hinlayagn il')?.id, 'hinlayagan-ilaud');
    assert.equal(first('brgy. mahagbo')?.id, 'mahagbu');
  });

  it('allows no typos in very short text', () => {
    assert.deepEqual(ids('soo'), ['soom']);
    assert.deepEqual(ids('som'), []);
  });

  it('finds a barangay named inside a longer search, ranked last', () => {
    assert.deepEqual(first('Banlasan elementary school'), {
      id: 'banlasan',
      name: 'Banlasan',
      match: 'mentioned',
    });
    assert.equal(first('market near town proper')?.id, POBLACION_ID);
  });

  it('ranks better matches first, then by name', () => {
    const kinds = searchBarangays('san').map(({ match }) => match);
    assert.deepEqual(kinds, [...kinds].sort((a, b) => order(a) - order(b)));
    assert.deepEqual(ids('san').slice(0, 2), ['san-isidro', 'san-vicente']);
    assert.ok(ids('san').includes('banlasan'));
  });

  it('returns nothing for unrelated or too-short text', () => {
    for (const text of ['', ' ', 'b', 'brgy', 'Trinidad, Bohol', 'jollibee', 'xyz', 'Tagbilaran City']) {
      assert.deepEqual(searchBarangays(text), [], JSON.stringify(text));
    }
  });
});

function order(kind: string): number {
  return ['exact', 'prefix', 'word', 'contains', 'typo', 'mentioned'].indexOf(kind);
}

describe('formatBarangayResultLabel', () => {
  it('labels barangays and Poblacion', () => {
    assert.equal(formatBarangayResultLabel({ id: 'banlasan', name: 'Banlasan' }), 'Barangay Banlasan · Trinidad');
    assert.equal(
      formatBarangayResultLabel({ id: POBLACION_ID, name: 'Poblacion' }),
      'Poblacion (Town proper) · Trinidad',
    );
  });
});

describe('searchBarangayLocations', () => {
  it('returns barangay suggestions pinned at each barangay pin point', () => {
    assert.deepEqual(searchBarangayLocations('brgy banlasn'), [
      {
        ...getBarangayPinPoint('banlasan'),
        address: 'Barangay Banlasan · Trinidad',
        kind: 'barangay',
        barangayId: 'banlasan',
        withinServiceArea: true,
      },
    ]);
    assert.deepEqual(searchBarangayLocations('Poblacion, Trinidad')[0], {
      latitude: 10.0792,
      longitude: 124.343,
      address: 'Poblacion (Town proper) · Trinidad',
      kind: 'barangay',
      barangayId: POBLACION_ID,
      withinServiceArea: true,
    });
  });

  it('keeps the match order', () => {
    assert.deepEqual(
      searchBarangayLocations('san').map(({ barangayId }) => barangayId),
      ['san-isidro', 'san-vicente', 'santo-tomas', 'banlasan'],
    );
  });

  it('starts at 2 characters', () => {
    assert.deepEqual(searchBarangayLocations('s'), []);
    assert.ok(searchBarangayLocations('so').length > 0);
  });
});

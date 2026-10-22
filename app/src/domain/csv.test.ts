import { describe, expect, it } from 'vitest';
import { cell, decimal, toCsv } from './csv';

describe('CSV', () => {
  it('Zahlen mit Komma, ohne Tausenderpunkt', () => {
    expect(decimal(1234.5)).toBe('1234,5');
    expect(decimal(51.3123456, 6)).toBe('51,312346');
    expect(decimal(undefined)).toBe('');
    expect(cell(-3)).toBe('-3'); // echte Zahlen nicht als Formel behandeln
  });

  it('Text: Trennzeichen, Anführungszeichen und Umbrüche werden eingeklammert', () => {
    expect(cell('Shad; 12 cm')).toBe('"Shad; 12 cm"');
    expect(cell('der "große"')).toBe('"der ""große"""');
    expect(cell('Zeile 1\nZeile 2')).toBe('"Zeile 1\nZeile 2"');
    expect(cell(undefined)).toBe('');
  });

  it('Formel-Einschleusung wird entschärft', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell('+1')).toBe("'+1");
    expect(cell('-Wobbler')).toBe("'-Wobbler");
    expect(cell('@Schilf')).toBe("'@Schilf");
  });

  it('Datei: BOM, Semikolon, CRLF', () => {
    expect(
      toCsv(
        ['A', 'B'],
        [
          ['x', 1.5],
          [undefined, 'y'],
        ],
      ),
    ).toBe('﻿A;B\r\nx;1,5\r\n;y\r\n');
  });
});

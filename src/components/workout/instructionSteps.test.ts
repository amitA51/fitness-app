import { describe, expect, it } from 'vitest';
import { splitInstructionSteps } from './instructionSteps';

describe('splitInstructionSteps', () => {
  it('returns [] for empty / nullish input', () => {
    expect(splitInstructionSteps()).toEqual([]);
    expect(splitInstructionSteps('')).toEqual([]);
    expect(splitInstructionSteps('   ')).toEqual([]);
    expect(splitInstructionSteps(null)).toEqual([]);
  });

  it('returns [] when there is no letter/digit content', () => {
    expect(splitInstructionSteps('... , ; .')).toEqual([]);
  });

  it('keeps a single clause as one step (trailing period stripped)', () => {
    expect(splitInstructionSteps('Maintain consistent pace.')).toEqual([
      'Maintain consistent pace',
    ]);
  });

  it('splits a Hebrew comma-separated cue into ordered steps', () => {
    expect(splitInstructionSteps('הורד מוט לאמצע החזה, דחוף למעלה בלי לנעול.')).toEqual([
      'הורד מוט לאמצע החזה',
      'דחוף למעלה בלי לנעול',
    ]);
  });

  it('splits an English comma-separated cue', () => {
    expect(
      splitInstructionSteps('Stand tall, jump feet out while raising arms overhead.')
    ).toEqual(['Stand tall', 'jump feet out while raising arms overhead']);
  });

  it('splits on multiple sentence terminators', () => {
    expect(splitInstructionSteps('Set up. Brace hard! Drive up?')).toEqual([
      'Set up',
      'Brace hard',
      'Drive up',
    ]);
  });

  it('normalizes runs of whitespace', () => {
    expect(splitInstructionSteps('  שמור   על   הגב   ישר  ')).toEqual(['שמור על הגב ישר']);
  });

  it('folds a too-short trailing fragment into the previous step', () => {
    expect(splitInstructionSteps('שמור על שרירי הליבה מכווצים, וכו׳')).toEqual([
      'שמור על שרירי הליבה מכווצים, וכו׳',
    ]);
  });

  it('caps the number of steps, folding overflow into the last step', () => {
    const seven = 'aaaaaa, bbbbbb, cccccc, dddddd, eeeeee, ffffff, gggggg';
    const result = splitInstructionSteps(seven);
    expect(result).toHaveLength(6);
    expect(result[5]).toBe('ffffff, gggggg');
  });
});

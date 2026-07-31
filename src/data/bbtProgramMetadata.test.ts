import { describe, expect, it } from 'vitest';
import { BBT_PROGRAM } from './bbtProgram.generated';
import { BBT_PROGRAM_METADATA, getBlockForWeek, getProgramDayMetadata } from './bbtProgramMetadata';

describe('bbtProgramMetadata', () => {
  it('matches every Dashboard-visible field in the generated catalog', () => {
    expect(BBT_PROGRAM_METADATA).toMatchObject({
      id: BBT_PROGRAM.id,
      title: BBT_PROGRAM.title,
      titleHe: BBT_PROGRAM.titleHe,
      level: BBT_PROGRAM.level,
      totalWeeks: BBT_PROGRAM.totalWeeks,
      blocks: BBT_PROGRAM.blocks,
    });

    for (const day of BBT_PROGRAM.days) {
      expect(getProgramDayMetadata(day.week, day.dayType)).toEqual({
        week: day.week,
        dayType: day.dayType,
        dayHe: day.dayHe,
        blockHe: day.blockHe,
        exerciseCount: day.exercises.length,
      });
      expect(getBlockForWeek(day.week)).toEqual({
        name: day.block,
        nameHe: day.blockHe,
      });
    }
  });
});

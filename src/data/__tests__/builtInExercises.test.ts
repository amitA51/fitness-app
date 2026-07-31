import { describe, expect, it } from 'vitest';
import { EQUIPMENT_KEYS } from '../../constants/equipmentNames';
import {
  FORCE_KEYS,
  LEVEL_KEYS,
  MECHANIC_KEYS,
  PRIMARY_MUSCLE_KEYS,
  muscleGroupOfPrimary,
  translatePrimaryMuscle,
} from '../../constants/exerciseClassification';
import {
  MUSCLE_FILTER_KEYS,
  matchesMuscleFilter,
  translateMuscle,
} from '../../constants/muscleNames';
import { getBUILT_IN_EXERCISES } from '../builtInExercises';

// The catalog is hand-authored Hebrew data seeded into every user's library.
// These checks are the guardrail for it: a typo in a classification key or an
// untranslated string would otherwise ship silently and only surface later as a
// filter that quietly matches nothing.

const catalog = getBUILT_IN_EXERCISES('2026-01-01T00:00:00.000Z');
const HEBREW = /[\u0590-\u05FF]/;

describe('built-in exercise catalog', () => {
  it('is a non-empty catalog with unique names', () => {
    expect(catalog.length).toBeGreaterThan(0);

    // The seeder (services/exerciseDb) de-duplicates built-ins BY NAME, so a
    // duplicate name would leave one of the two permanently unreachable.
    const names = catalog.map((exercise) => exercise.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names every exercise in Hebrew', () => {
    const missingHebrew = catalog
      .filter((exercise) => !HEBREW.test(exercise.name ?? ''))
      .map((exercise) => exercise.name);
    expect(missingHebrew).toEqual([]);
  });

  it('explains every exercise in Hebrew', () => {
    // notes = what it trains, tutorialText = how to perform it. Both reach the
    // user, so neither may be English-only.
    const englishOnly = catalog
      .filter((exercise) => {
        const notes = exercise.notes ?? '';
        const tutorial = exercise.tutorialText ?? '';
        return (notes && !HEBREW.test(notes)) || (tutorial && !HEBREW.test(tutorial));
      })
      .map((exercise) => exercise.name);
    expect(englishOnly).toEqual([]);
  });

  it('classifies every exercise so the library can sort and filter it', () => {
    const unclassified = catalog
      .filter((exercise) => !exercise.mechanic || !exercise.level || !exercise.primaryMuscle)
      .map((exercise) => exercise.name);
    expect(unclassified).toEqual([]);
  });

  it('uses only known classification keys', () => {
    const invalid: string[] = [];
    for (const exercise of catalog) {
      const label = exercise.name ?? '(unnamed)';
      if (exercise.mechanic && !MECHANIC_KEYS.includes(exercise.mechanic)) {
        invalid.push(`${label}: mechanic=${exercise.mechanic}`);
      }
      if (exercise.force && !FORCE_KEYS.includes(exercise.force)) {
        invalid.push(`${label}: force=${exercise.force}`);
      }
      if (exercise.level && !LEVEL_KEYS.includes(exercise.level)) {
        invalid.push(`${label}: level=${exercise.level}`);
      }
      if (
        exercise.primaryMuscle &&
        !(PRIMARY_MUSCLE_KEYS as readonly string[]).includes(exercise.primaryMuscle)
      ) {
        invalid.push(`${label}: primaryMuscle=${exercise.primaryMuscle}`);
      }
    }
    expect(invalid).toEqual([]);
  });

  it('uses only equipment keys the filter can offer', () => {
    const unknown = catalog
      .filter(
        (exercise) =>
          !exercise.equipment || !(EQUIPMENT_KEYS as readonly string[]).includes(exercise.equipment)
      )
      .map((exercise) => `${exercise.name}: ${exercise.equipment}`);
    expect(unknown).toEqual([]);
  });

  it('ships usable set and rest defaults', () => {
    const bad = catalog
      .filter((exercise) => {
        const sets = exercise.defaultSets ?? 0;
        const rest = exercise.defaultRestTime ?? -1;
        return sets < 1 || sets > 10 || rest < 0 || rest > 300;
      })
      .map((exercise) => `${exercise.name}: sets=${exercise.defaultSets}`);
    expect(bad).toEqual([]);
  });

  it('leaves no filter chip matching nothing', () => {
    // The original bug this guards: the library offered a "ידיים" chip while the
    // catalog tagged arm work Biceps/Triceps, so the chip matched zero exercises
    // and every arm exercise was reachable only by search.
    //
    // `Other` is exempt by design — it is the catch-all for exercises the USER
    // creates without picking a muscle (ExerciseLibraryTab defaults them to
    // 'Other'), so it is expected to match nothing in the shipped catalog.
    const catalogBackedChips = MUSCLE_FILTER_KEYS.filter((key) => key !== 'Other');
    const emptyChips = catalogBackedChips.filter(
      (key) => !catalog.some((exercise) => matchesMuscleFilter(key, exercise))
    );
    expect(emptyChips).toEqual([]);
  });

  it('offers every equipment and level value the filter exposes', () => {
    const unusedEquipment = EQUIPMENT_KEYS.filter(
      (key) => !catalog.some((exercise) => exercise.equipment === key)
    );
    expect(unusedEquipment).toEqual([]);

    const unusedLevels = LEVEL_KEYS.filter(
      (key) => !catalog.some((exercise) => exercise.level === key)
    );
    expect(unusedLevels).toEqual([]);

    const unusedMechanics = MECHANIC_KEYS.filter(
      (key) => !catalog.some((exercise) => exercise.mechanic === key)
    );
    expect(unusedMechanics).toEqual([]);
  });

  it('renders every muscle it references in Hebrew', () => {
    // MuscleMap builds its screen-reader label from these values, so an
    // untranslated one was literally reading English muscle names to a Hebrew
    // user. Derived from the catalog rather than a fixed list, so a newly
    // introduced muscle name cannot slip through untranslated.
    const referenced = new Set<string>();
    for (const exercise of catalog) {
      if (exercise.primaryMuscle) referenced.add(exercise.primaryMuscle);
      for (const secondary of exercise.secondaryMuscles ?? []) referenced.add(secondary);
    }
    expect(referenced.size).toBeGreaterThan(0);

    const untranslated = [...referenced].filter((muscle) => {
      const fine = translatePrimaryMuscle(muscle);
      const coarse = translateMuscle(muscle);
      return !HEBREW.test(fine) && !HEBREW.test(coarse);
    });
    expect(untranslated).toEqual([]);
  });

  it('maps every prime mover it uses onto a coarse muscle group', () => {
    // Two vocabularies describe muscles: the fine prime mover and the coarse group
    // the library tabs by. If a new primaryMuscle is introduced without a coarse
    // mapping the taxonomy has a hole, and anything deriving a group from it
    // silently gets `undefined`.
    const unmapped = [...new Set(catalog.map((exercise) => exercise.primaryMuscle))]
      .filter((muscle): muscle is string => Boolean(muscle))
      .filter((muscle) => !muscleGroupOfPrimary(muscle));
    expect(unmapped).toEqual([]);
  });

  it('covers the training domains the app has categories for', () => {
    // `flexibility` had a category constant but not a single exercise, so a user
    // finishing a session had nothing to log for a stretch.
    const categories = new Set(catalog.map((exercise) => exercise.category));
    for (const expected of ['strength', 'cardio', 'flexibility', 'warmup']) {
      expect(categories.has(expected)).toBe(true);
    }
  });
});

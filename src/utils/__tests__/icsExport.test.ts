import { describe, expect, it } from 'vitest';
import { type IcsEvent, buildIcsCalendar, downloadIcs } from '../icsExport';

// ============================================================================
// buildIcsCalendar
// ============================================================================

describe('buildIcsCalendar — header and footer', () => {
  it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR', () => {
    // Arrange
    const events: IcsEvent[] = [];

    // Act
    const result = buildIcsCalendar(events);

    // Assert
    expect(result.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(result.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('includes VERSION:2.0 and a PRODID', () => {
    // Arrange / Act
    const result = buildIcsCalendar([]);

    // Assert
    expect(result).toContain('VERSION:2.0');
    expect(result).toContain('PRODID:');
  });

  it('includes CALSCALE:GREGORIAN and METHOD:PUBLISH', () => {
    const result = buildIcsCalendar([]);
    expect(result).toContain('CALSCALE:GREGORIAN');
    expect(result).toContain('METHOD:PUBLISH');
  });
});

describe('buildIcsCalendar — CRLF line endings', () => {
  it('uses CRLF (\\r\\n) throughout', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'test-uid-1',
      title: 'Morning Run',
      start: new Date('2026-07-01T06:00:00Z'),
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert — every line break must be \r\n
    const linesLF = result.split('\n');
    // Every line (except the last empty one) should end with \r
    for (const line of linesLF.slice(0, -1)) {
      expect(line.endsWith('\r')).toBe(true);
    }
  });

  it('produces a valid empty VCALENDAR with CRLF for zero events', () => {
    // Arrange / Act
    const result = buildIcsCalendar([]);

    // Assert
    expect(result).toContain('\r\n');
    expect(result).not.toContain('VEVENT');
  });
});

describe('buildIcsCalendar — UTC date/time formatting', () => {
  it('formats DTSTART in UTC yyyymmddThhmmssZ form', () => {
    // Arrange
    const start = new Date('2026-08-15T09:30:00Z');
    const event: IcsEvent = { uid: 'uid-dt', title: 'Test', start };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DTSTART:20260815T093000Z');
  });

  it('formats DTEND in UTC yyyymmddThhmmssZ form when provided', () => {
    // Arrange
    const start = new Date('2026-08-15T09:30:00Z');
    const end = new Date('2026-08-15T10:30:00Z');
    const event: IcsEvent = { uid: 'uid-dtend', title: 'Test', start, end };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DTEND:20260815T103000Z');
  });

  it('defaults DTEND to DTSTART + 1 hour when end is omitted', () => {
    // Arrange
    const start = new Date('2026-08-15T09:00:00Z');
    const event: IcsEvent = { uid: 'uid-noend', title: 'Test', start };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert — end = 10:00 UTC
    expect(result).toContain('DTEND:20260815T100000Z');
  });

  it('accepts ISO string as start instead of a Date object', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-str',
      title: 'ISO String Event',
      start: '2026-09-01T07:00:00Z',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DTSTART:20260901T070000Z');
  });
});

describe('buildIcsCalendar — text escaping', () => {
  it('escapes backslashes in the title', () => {
    // Arrange
    const event: IcsEvent = { uid: 'uid-bs', title: 'A\\B', start: new Date() };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('SUMMARY:A\\\\B');
  });

  it('escapes commas in the title', () => {
    // Arrange
    const event: IcsEvent = { uid: 'uid-comma', title: 'Arms, Shoulders', start: new Date() };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('SUMMARY:Arms\\, Shoulders');
  });

  it('escapes semicolons in the description', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-semi',
      title: 'Test',
      start: new Date(),
      description: 'Set 1; Set 2',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DESCRIPTION:Set 1\\; Set 2');
  });

  it('escapes newlines in the description to \\n literal', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-nl',
      title: 'Test',
      start: new Date(),
      description: 'Line1\nLine2',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DESCRIPTION:Line1\\nLine2');
  });

  it('escapes Windows-style CRLF newlines in description', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-crlf',
      title: 'Test',
      start: new Date(),
      description: 'A\r\nB',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DESCRIPTION:A\\nB');
  });
});

describe('buildIcsCalendar — empty and invalid inputs', () => {
  it('returns a valid VCALENDAR for an empty array', () => {
    // Arrange / Act
    const result = buildIcsCalendar([]);

    // Assert
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('END:VCALENDAR');
    expect(result).not.toContain('BEGIN:VEVENT');
  });

  it('does not throw when passed a non-array (type coercion guard)', () => {
    // Arrange / Act / Assert — no throw
    expect(() => buildIcsCalendar(null as unknown as IcsEvent[])).not.toThrow();
  });

  it('falls back gracefully when start is an invalid date string', () => {
    // Arrange
    const event: IcsEvent = { uid: 'uid-bad', title: 'Bad date', start: 'not-a-date' };

    // Act / Assert — no throw; uses fallback
    expect(() => buildIcsCalendar([event])).not.toThrow();
    const result = buildIcsCalendar([event]);
    expect(result).toContain('DTSTART:');
  });
});

describe('buildIcsCalendar — VEVENT contents', () => {
  it('includes BEGIN:VEVENT and END:VEVENT for each event', () => {
    // Arrange
    const events: IcsEvent[] = [
      { uid: 'e1', title: 'Workout A', start: new Date('2026-07-01T08:00:00Z') },
      { uid: 'e2', title: 'Workout B', start: new Date('2026-07-02T08:00:00Z') },
    ];

    // Act
    const result = buildIcsCalendar(events);

    // Assert
    const beginCount = (result.match(/BEGIN:VEVENT/g) ?? []).length;
    const endCount = (result.match(/END:VEVENT/g) ?? []).length;
    expect(beginCount).toBe(2);
    expect(endCount).toBe(2);
  });

  it('includes UID, DTSTAMP, SUMMARY in each VEVENT', () => {
    // Arrange
    const event: IcsEvent = { uid: 'uid-full', title: 'Full event', start: new Date() };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('UID:uid-full');
    expect(result).toContain('DTSTAMP:');
    expect(result).toContain('SUMMARY:Full event');
  });

  it('includes optional DESCRIPTION when provided', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-desc',
      title: 'With Description',
      start: new Date(),
      description: 'Bring water',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('DESCRIPTION:Bring water');
  });

  it('includes optional LOCATION when provided', () => {
    // Arrange
    const event: IcsEvent = {
      uid: 'uid-loc',
      title: 'At gym',
      start: new Date(),
      location: 'Fitness Center, Tel Aviv',
    };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).toContain('LOCATION:Fitness Center\\, Tel Aviv');
  });

  it('omits DESCRIPTION and LOCATION lines when not provided', () => {
    // Arrange
    const event: IcsEvent = { uid: 'uid-min', title: 'Minimal', start: new Date() };

    // Act
    const result = buildIcsCalendar([event]);

    // Assert
    expect(result).not.toContain('DESCRIPTION:');
    expect(result).not.toContain('LOCATION:');
  });
});

// ============================================================================
// downloadIcs
// ============================================================================

describe('downloadIcs — browser-guard', () => {
  it('does not throw in a non-browser (JSDOM) environment without Blob', () => {
    // Arrange / Act / Assert — calling in Vitest/JSDOM should not throw
    expect(() => downloadIcs('test.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')).not.toThrow();
  });

  it('appends .ics extension when filename lacks it', () => {
    // We can only test that it does not throw; actual anchor click is DOM-side.
    expect(() => downloadIcs('my-schedule', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')).not.toThrow();
  });
});

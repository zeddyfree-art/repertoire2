import { describe, expect, it } from 'vitest';
import { lineFromSans } from './chess';
import { addLine, newRepertoire, setPaused, setTrainDepth } from './repertoire';
import { gradeCard, Rating, State, syncCards } from './srs';
import { reviewOnlyPlan, unlearnedMoves, type TrainPrefs } from './today';

const prefs: TrainPrefs = { newMoves: 50, newMistakes: 10, withMistakes: true, wholeLines: true };
const prepared = () => syncCards(addLine(
  newRepertoire('player', 'Scotch', 'white'),
  lineFromSans(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'])!,
));

describe('Round A: Review vs Learn are independent and preserve SRS', () => {
  it('Review introduces zero new cards even when existing preferences demand 50 new moves', () => {
    const rep = prepared();
    const before = structuredClone(rep.cards);
    const plan = reviewOnlyPlan([rep], [], prefs);
    expect(plan.fresh).toBe(0);
    expect(plan.due).toBe(0);
    expect(plan.total).toBe(0);
    expect(plan.parts).toHaveLength(0);
    expect(rep.cards).toEqual(before);
    expect(unlearnedMoves(rep)).toHaveLength(4);
  });

  it('Review selects due reviewed cards only, even when one repertoire is paused', () => {
    const rep = prepared();
    const [first, second] = Object.keys(rep.cards);
    const past = 1000;
    const changed = {
      ...rep,
      cards: {
        ...rep.cards,
        [first]: gradeCard(rep.cards[first], Rating.Good, past),
        [second]: gradeCard(rep.cards[second], Rating.Good, past),
      },
    };
    const paused = setPaused({ ...changed, id: 'paused' }, true);
    const plan = reviewOnlyPlan([changed, paused], [], prefs, Date.now() + 365 * 86400e3);
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0].kind).toBe('review');
    if (plan.parts[0].kind === 'review') {
      expect(plan.parts[0].items.every((x) => !x.isNew)).toBe(true);
      expect(plan.parts[0].items).toHaveLength(2);
    }
    expect(unlearnedMoves(paused)).toHaveLength(0);
  });

  it('Stop leaves every unattempted SRS card new; only answered cards change', () => {
    const rep = prepared();
    const ids = Object.keys(rep.cards);
    const before = structuredClone(rep.cards);
    const afterFirstAnswer = {
      ...rep,
      cards: {
        ...rep.cards,
        [ids[0]]: gradeCard(rep.cards[ids[0]], Rating.Good),
      },
    };
    expect(afterFirstAnswer.cards[ids[0]].state).not.toBe(State.New);
    for (const id of ids.slice(1)) {
      expect(afterFirstAnswer.cards[id]).toEqual(before[id]);
      expect(afterFirstAnswer.cards[id].state).toBe(State.New);
    }
    expect(unlearnedMoves(afterFirstAnswer)).toHaveLength(ids.length - 1);
    expect(unlearnedMoves(afterFirstAnswer).every((x) => x.id !== ids[0])).toBe(true);
    expect(rep.cards).toEqual(before);
  });

  it('training depth is respected in Learn without modifying deeper cards', () => {
    const rep = prepared();
    const shallow = setTrainDepth(rep, 1);
    expect(unlearnedMoves(shallow)).toHaveLength(1);
    expect(unlearnedMoves(rep)).toHaveLength(4);
    expect(Object.keys(shallow.cards)).toHaveLength(4);
  });
});

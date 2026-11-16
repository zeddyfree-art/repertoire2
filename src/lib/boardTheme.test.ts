import { describe, expect, it } from 'vitest';
import { BOARD_THEMES, boardImage } from './boardTheme';

describe('Warm Studio board theme', () => {
  it('provides a distinct ivory and sage board', () => {
    expect(BOARD_THEMES.studio.light).toBe('#f0ead8');
    expect(BOARD_THEMES.studio.dark).toBe('#9ead88');
    expect(boardImage(BOARD_THEMES.studio.light, BOARD_THEMES.studio.dark)).toContain('data:image/svg+xml');
  });
  it('keeps all previous board options', () => {
    expect(BOARD_THEMES.brown).toBeDefined();
    expect(BOARD_THEMES.green).toBeDefined();
    expect(BOARD_THEMES.wood).toBeDefined();
  });
});

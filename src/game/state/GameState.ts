/**
 * GameState — FSM phases and transition rules.
 *
 * idle → betting → running → resolve → win/lose → reset → idle
 *
 * Transition lock: no input accepted while phase ∈ { running, resolve }.
 */

export type GamePhase =
  | 'idle'
  | 'betting'
  | 'running'
  | 'resolve'
  | 'win'
  | 'lose'
  | 'reset';

export class GameState {
  private _phase: GamePhase = 'idle';

  get phase(): GamePhase { return this._phase; }

  /** Returns true if any user input (spin / collect) should be blocked. */
  get isLocked(): boolean {
    return this._phase === 'running' || this._phase === 'resolve';
  }

  transition(next: GamePhase): void {
    // Optional: add guard table here for strict FSM enforcement
    this._phase = next;
  }
}

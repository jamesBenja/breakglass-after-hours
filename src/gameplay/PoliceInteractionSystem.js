export class PoliceInteractionSystem {
  constructor({ ui, sceneManager }) {
    this.ui = ui;
    this.sceneManager = sceneManager;
  }

  handle(target) {
    if (target?.action !== 'police') return false;
    const alley = this.sceneManager.current?.alley;
    if (!alley) return false;
    const snapshot = alley.snapshot();

    if (snapshot.evacuationRequired) {
      this.ui.panel(
        'POLICE · PARTY SHUTDOWN',
        snapshot.policeVisits >= 2
          ? 'They came back after the warning. The party is over. Music has to stop and the building has to be cleared.'
          : 'The conversation went badly. Police are ending the party and everyone has to leave.',
        [],
      );
      return true;
    }

    this.ui.panel(
      'POLICE · NEIGHBOUR COMPLAINT',
      `Officers say they received a noise complaint from the alley. This is visit ${snapshot.policeVisits}. How you handle it matters.`,
      [
        [
          'Apologize + move everyone inside',
          () => {
            const outcome = alley.resolvePolice('cooperate');
            this.ui.panel('POLICE WARNING', outcome, []);
          },
        ],
        [
          'Say it is under control',
          () => {
            const outcome = alley.resolvePolice('brushOff');
            this.ui.panel('POLICE WARNING', outcome, []);
          },
        ],
        [
          'Argue about the complaint',
          () => {
            const outcome = alley.resolvePolice('argue');
            this.ui.panel('POLICE · PARTY SHUTDOWN', outcome, []);
          },
        ],
      ],
    );
    return true;
  }
}

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
        snapshot.lastPoliceOutcome === 'ignored'
          ? 'The warning expired before anyone dealt with the officers. Police are ending the party and the building has to be cleared.'
          : snapshot.policeVisits >= 2
            ? 'The return visit escalated into a shutdown. Music has to stop and the building has to be cleared.'
            : 'The conversation went badly. Police are ending the party and everyone has to leave.',
        [],
      );
      return true;
    }

    this.ui.panel(
      'POLICE · NEIGHBOUR COMPLAINT',
      snapshot.policeVisits > 1
        ? `Officers are back after another alley noise complaint. This is visit ${snapshot.policeVisits}, so you have less time to calm things down.`
        : 'Officers say they received a noise complaint from the alley. Talk to them and get the outside crowd under control before it escalates.',
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

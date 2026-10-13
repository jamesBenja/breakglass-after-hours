export const BREAKGLASS_DOOR_QUESTIONS = [
  {
    prompt: 'What is upstairs from Below Breakglass?',
    correct: 'The recording studios',
    choices: ['The recording studios', 'Another club room', 'The loading dock'],
  },
  {
    prompt: 'What is the downstairs venue called?',
    correct: 'Below Breakglass',
    choices: ['Below Breakglass', 'Clark Hall', 'Take A Break'],
  },
  {
    prompt: 'What is the most important rule in the alley?',
    correct: 'Keep it quiet for the neighbours',
    choices: [
      'Keep it quiet for the neighbours',
      'Turn the music up outside',
      'Move the party into the alley',
    ],
  },
];

const isJamesDialogue = (target, game) => {
  const id = target?.npcId ?? target?.id;
  return (
    target?.action === 'dialogue' &&
    id === 'james' &&
    game.sceneManager.current?.definition?.id === 'alley'
  );
};

export function installGuestlistDoorEnhancements(game, ui) {
  if (!game || game._guestlistDoorEnhancementsInstalled) return;
  game._guestlistDoorEnhancementsInstalled = true;

  const bouncer = game.crowdDoor?.bouncer;
  if (!bouncer) return;

  const save = () => game.save?.();
  const displayName = () => game.state?.data?.avatar?.displayName ?? 'Guest';

  const wrongBreakglassAnswer = () => {
    bouncer.wrongAnswers = (bouncer.wrongAnswers ?? 0) + 1;
    const seconds = Math.min(45, 12 + bouncer.wrongAnswers * 8);
    bouncer.waitUntil = Date.now() + seconds * 1000;
    ui.panel(
      'SAM · NOT YET',
      `Nope. Sam sends you back to the alley for ${seconds} seconds before you can try again.`,
      [],
    );
  };

  bouncer.djQuiz = () => {
    const index = (bouncer.wrongAnswers ?? 0) % BREAKGLASS_DOOR_QUESTIONS.length;
    const question = BREAKGLASS_DOOR_QUESTIONS[index];
    ui.panel(
      'SAM · BREAKGLASS CHECK',
      `${question.prompt} Get it right and Sam will let you skip the line.`,
      question.choices.map((choice) => [
        choice,
        () => {
          if (choice !== question.correct) {
            wrongBreakglassAnswer();
            return;
          }
          ui.warning?.('Correct. Sam waves you past the line.');
          bouncer.enter();
        },
      ]),
    );
  };

  bouncer.guestPanel = () => {
    ui.panel('SAM · GUESTLIST', 'Sam asks if you are on the guestlist.', [
      [
        'Yes, I should be on the guestlist',
        () => {
          if (game.state?.data?.guestlistApproved === true) {
            ui.warning?.(`Sam finds ${displayName()} on the list and waves you through.`);
            bouncer.enter();
            return;
          }
          if (game.state?.data) game.state.data.guestlistReferralPending = true;
          save();
          ui.panel(
            'SAM · NOT ON THE LIST',
            `Sam checks for ${displayName()} and cannot find you. “You are not on here, and I cannot add you. Talk to James.”`,
            [],
          );
        },
      ],
      ['No, I am not on the guestlist', () => bouncer.djQuiz()],
    ]);
  };

  const baseDispatch = game.interactions?.dispatch?.bind(game.interactions);
  if (baseDispatch) {
    game.interactions.dispatch = (target) => {
      const state = game.state?.data;
      if (
        isJamesDialogue(target, game) &&
        state?.guestlistReferralPending === true &&
        state?.guestlistApproved !== true
      ) {
        const addToGuestlist = (source) => {
          state.guestlistApproved = true;
          state.guestlistReferralPending = false;
          state.guestlistAddedByJames = true;
          save();
          ui.panel(
            'JAMES · GUESTLIST',
            `“All good. I added ${displayName()} to the list. Go back to Sam and tell him you are on it.”`,
            [],
          );
          ui.warning?.(`James added you to the guestlist (${source}).`);
        };

        ui.panel(
          'JAMES · GUESTLIST',
          '“Sam says you are not on the list? Who told you you would be on it?”',
          [
            [
              'A friend of Breakglass. Sorry for the mix-up — could you please add me?',
              () => addToGuestlist('friend of Breakglass'),
            ],
            [
              'One of the artists playing tonight. Would you mind adding me?',
              () => addToGuestlist('artist referral'),
            ],
            [
              'I do not remember. Just put me on the list.',
              () =>
                ui.panel(
                  'JAMES · GUESTLIST',
                  '“That is not really how this works. Ask me like a person and I can probably help you.”',
                  [],
                ),
            ],
          ],
        );
        return;
      }
      baseDispatch(target);
    };
  }
}

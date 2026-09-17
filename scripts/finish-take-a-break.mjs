import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/interactions/createActions.js';
let text = await readFile(path, 'utf8');
const before = `Four HRTF sound emitters occupy the room. Walk around them and the image changes with your position and camera orientation`;
const after = `Eight HRTF virtual speakers occupy the room. The installation takes over the sound field here, with energy moving continuously around the eight positions as you walk and turn`;
if (!text.includes(before)) throw new Error('Take A Break installation copy anchor not found');
text = text.replace(before, after);
await writeFile(path, text);

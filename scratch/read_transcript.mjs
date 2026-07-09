import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream("C:/Users/Usuario/.gemini/antigravity/brain/78f1dd7b-8768-4869-aecb-e578650a69d7/.system_generated/logs/transcript.jsonl");

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let count = 0;
const lastInputs = [];

for await (const line of rl) {
  const data = JSON.parse(line);
  if (data.type === 'USER_INPUT') {
    lastInputs.push(data);
    if (lastInputs.length > 15) {
      lastInputs.shift();
    }
  }
}

for (const input of lastInputs) {
  console.log(`Step ${input.step_index} (${input.created_at}): ${input.content}`);
}
